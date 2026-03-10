package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DashboardHandler struct {
	db *gorm.DB
}

func NewDashboardHandler(db *gorm.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

type NotificationItem struct {
	Type      string `json:"type"`
	ProductID string `json:"product_id"`
	SKU       string `json:"sku"`
	Name      string `json:"name"`
	Stock     int    `json:"stock"`
	Alert     int    `json:"alert"`
}

func (h *DashboardHandler) Notifications(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var lowStock []ecomModels.Product
	h.db.Where("company_id = ? AND track_stock = ? AND stock_quantity > 0 AND stock_quantity <= low_stock_alert AND is_active = ?", companyID, true, true).
		Order("stock_quantity asc").Limit(50).Find(&lowStock)

	var outOfStock []ecomModels.Product
	h.db.Where("company_id = ? AND track_stock = ? AND stock_quantity <= 0 AND is_active = ?", companyID, true, true).
		Order("name asc").Limit(50).Find(&outOfStock)

	var notifications []NotificationItem
	for _, p := range outOfStock {
		notifications = append(notifications, NotificationItem{
			Type: "out_of_stock", ProductID: p.ID.String(), SKU: p.SKU, Name: p.Name, Stock: p.StockQuantity, Alert: p.LowStockAlert,
		})
	}
	for _, p := range lowStock {
		notifications = append(notifications, NotificationItem{
			Type: "low_stock", ProductID: p.ID.String(), SKU: p.SKU, Name: p.Name, Stock: p.StockQuantity, Alert: p.LowStockAlert,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"notifications": notifications,
			"count":         len(notifications),
		},
	})
}

type AccountingStats struct {
	TotalRevenue   float64             `json:"total_revenue"`
	TotalExpenses  float64             `json:"total_expenses"`
	NetProfit      float64             `json:"net_profit"`
	CashBalance    float64             `json:"cash_balance"`
	RecentJournals []accModels.Journal `json:"recent_journals"`
	MonthlyData    []MonthlyDataPoint  `json:"monthly_data"`
}

type MonthlyDataPoint struct {
	Month    string  `json:"month"`
	Revenue  float64 `json:"revenue"`
	Expenses float64 `json:"expenses"`
}

func (h *DashboardHandler) AccountingDashboard(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	now := time.Now()
	yearStart := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)

	var totalRevenue, totalExpenses, cashBalance float64

	// Revenue: sum credits on revenue accounts (type = 'revenue')
	h.db.Raw(`
		SELECT COALESCE(SUM(je.credit_amount - je.debit_amount), 0)
		FROM journal_entries je
		JOIN journals j ON j.id = je.journal_id AND j.deleted_at IS NULL
		JOIN accounts a ON a.id = je.account_id AND a.deleted_at IS NULL
		WHERE je.deleted_at IS NULL AND j.company_id = ? AND j.status = 'posted' AND j.date >= ? AND a.account_type = 'revenue'
	`, companyID, yearStart).Scan(&totalRevenue)

	// Expenses: sum debits on expense accounts (type = 'expense')
	h.db.Raw(`
		SELECT COALESCE(SUM(je.debit_amount - je.credit_amount), 0)
		FROM journal_entries je
		JOIN journals j ON j.id = je.journal_id AND j.deleted_at IS NULL
		JOIN accounts a ON a.id = je.account_id AND a.deleted_at IS NULL
		WHERE je.deleted_at IS NULL AND j.company_id = ? AND j.status = 'posted' AND j.date >= ? AND a.account_type = 'expense'
	`, companyID, yearStart).Scan(&totalExpenses)

	// Cash balance: current_balance on cash accounts (code starts with 11)
	h.db.Raw(`
		SELECT COALESCE(SUM(current_balance), 0)
		FROM accounts
		WHERE company_id = ? AND code LIKE '11%' AND is_active = true AND deleted_at IS NULL
	`, companyID).Scan(&cashBalance)

	// Recent journals
	var recentJournals []accModels.Journal
	h.db.Where("company_id = ?", companyID).Order("date desc").Limit(5).Find(&recentJournals)

	// Monthly data (last 6 months)
	var monthlyData []MonthlyDataPoint
	for i := 5; i >= 0; i-- {
		mStart := time.Date(now.Year(), now.Month()-time.Month(i), 1, 0, 0, 0, 0, time.UTC)
		mEnd := mStart.AddDate(0, 1, 0)

		var rev, exp float64
		h.db.Raw(`
			SELECT COALESCE(SUM(je.credit_amount - je.debit_amount), 0)
			FROM journal_entries je
			JOIN journals j ON j.id = je.journal_id AND j.deleted_at IS NULL
			JOIN accounts a ON a.id = je.account_id AND a.deleted_at IS NULL
			WHERE je.deleted_at IS NULL AND j.company_id = ? AND j.status = 'posted' AND j.date >= ? AND j.date < ? AND a.account_type = 'revenue'
		`, companyID, mStart, mEnd).Scan(&rev)

		h.db.Raw(`
			SELECT COALESCE(SUM(je.debit_amount - je.credit_amount), 0)
			FROM journal_entries je
			JOIN journals j ON j.id = je.journal_id AND j.deleted_at IS NULL
			JOIN accounts a ON a.id = je.account_id AND a.deleted_at IS NULL
			WHERE je.deleted_at IS NULL AND j.company_id = ? AND j.status = 'posted' AND j.date >= ? AND j.date < ? AND a.account_type = 'expense'
		`, companyID, mStart, mEnd).Scan(&exp)

		monthlyData = append(monthlyData, MonthlyDataPoint{
			Month:    mStart.Format("Jan"),
			Revenue:  rev,
			Expenses: exp,
		})
	}

	stats := AccountingStats{
		TotalRevenue:   totalRevenue,
		TotalExpenses:  totalExpenses,
		NetProfit:      totalRevenue - totalExpenses,
		CashBalance:    cashBalance,
		RecentJournals: recentJournals,
		MonthlyData:    monthlyData,
	}

	return c.JSON(fiber.Map{"success": true, "data": stats})
}

type EcommerceStats struct {
	TotalOrders    int64                `json:"total_orders"`
	TotalProducts  int64                `json:"total_products"`
	TotalCustomers int64                `json:"total_customers"`
	MonthRevenue   float64              `json:"month_revenue"`
	RecentOrders   []ecomModels.Order   `json:"recent_orders"`
	LowStockItems  []ecomModels.Product `json:"low_stock_items"`
	OrdersByStatus []StatusCount        `json:"orders_by_status"`
	MonthlyRevenue []MonthlyDataPoint   `json:"monthly_revenue"`
}

type StatusCount struct {
	Status string `json:"status"`
	Count  int64  `json:"count"`
}

func (h *DashboardHandler) EcommerceDashboard(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	var totalOrders, totalProducts, totalCustomers int64
	var monthRevenue float64

	h.db.Model(&ecomModels.Order{}).Where("company_id = ?", companyID).Count(&totalOrders)
	h.db.Model(&ecomModels.Product{}).Where("company_id = ? AND is_active = ?", companyID, true).Count(&totalProducts)
	h.db.Model(&ecomModels.Customer{}).Where("company_id = ? AND is_active = ?", companyID, true).Count(&totalCustomers)

	h.db.Model(&ecomModels.Order{}).
		Where("company_id = ? AND order_date >= ? AND status != ?", companyID, monthStart, "cancelled").
		Select("COALESCE(SUM(total_amount), 0)").Scan(&monthRevenue)

	var recentOrders []ecomModels.Order
	h.db.Where("company_id = ?", companyID).Preload("Customer").Order("created_at desc").Limit(5).Find(&recentOrders)

	var lowStockItems []ecomModels.Product
	h.db.Where("company_id = ? AND track_stock = ? AND is_active = ? AND stock_quantity <= low_stock_alert", companyID, true, true).
		Preload("Category").Order("stock_quantity asc").Limit(5).Find(&lowStockItems)

	var ordersByStatus []StatusCount
	h.db.Model(&ecomModels.Order{}).
		Where("company_id = ?", companyID).
		Select("status, count(*) as count").
		Group("status").Scan(&ordersByStatus)

	var monthlyRevenue []MonthlyDataPoint
	for i := 5; i >= 0; i-- {
		mStart := time.Date(now.Year(), now.Month()-time.Month(i), 1, 0, 0, 0, 0, time.UTC)
		mEnd := mStart.AddDate(0, 1, 0)
		var rev float64
		h.db.Model(&ecomModels.Order{}).
			Where("company_id = ? AND order_date >= ? AND order_date < ? AND status != ?", companyID, mStart, mEnd, "cancelled").
			Select("COALESCE(SUM(total_amount), 0)").Scan(&rev)
		monthlyRevenue = append(monthlyRevenue, MonthlyDataPoint{
			Month:   mStart.Format("Jan"),
			Revenue: rev,
		})
	}

	stats := EcommerceStats{
		TotalOrders:    totalOrders,
		TotalProducts:  totalProducts,
		TotalCustomers: totalCustomers,
		MonthRevenue:   monthRevenue,
		RecentOrders:   recentOrders,
		LowStockItems:  lowStockItems,
		OrdersByStatus: ordersByStatus,
		MonthlyRevenue: monthlyRevenue,
	}

	return c.JSON(fiber.Map{"success": true, "data": stats})
}

func (h *DashboardHandler) RegisterRoutes(api fiber.Router) {
	api.Get("/notifications", h.Notifications)
	api.Get("/dashboard/accounting", h.AccountingDashboard)
	api.Get("/dashboard/ecommerce", h.EcommerceDashboard)
}
