package handlers

import (
	"math"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ReceivableHandler struct {
	db *gorm.DB
}

func NewReceivableHandler(db *gorm.DB) *ReceivableHandler {
	return &ReceivableHandler{db: db}
}

type CustomerReceivable struct {
	CustomerID   string  `json:"customer_id"`
	CustomerName string  `json:"customer_name"`
	CompanyName  string  `json:"company_name"`
	TotalAmount  float64 `json:"total_amount"`
	PaidAmount   float64 `json:"paid_amount"`
	Outstanding  float64 `json:"outstanding"`
	Current      float64 `json:"current"`
	Days30       float64 `json:"days_30"`
	Days60       float64 `json:"days_60"`
	Days90Plus   float64 `json:"days_90_plus"`
	InvoiceCount int     `json:"invoice_count"`
}

type ReceivableSummary struct {
	TotalOutstanding float64              `json:"total_outstanding"`
	TotalOverdue     float64              `json:"total_overdue"`
	TotalCurrent     float64              `json:"total_current"`
	Customers        []CustomerReceivable `json:"customers"`
}

func (h *ReceivableHandler) GetReceivables(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	now := time.Now()

	type invoiceRow struct {
		CustomerID  string    `gorm:"column:customer_id"`
		FirstName   string    `gorm:"column:first_name"`
		LastName    string    `gorm:"column:last_name"`
		CompanyName string    `gorm:"column:company_name"`
		TotalAmount float64   `gorm:"column:total_amount"`
		PaidAmount  float64   `gorm:"column:paid_amount"`
		DueDate     time.Time `gorm:"column:due_date"`
	}

	var rows []invoiceRow
	h.db.Raw(`
		SELECT i.customer_id, c.first_name, c.last_name, COALESCE(c.company_name, '') as company_name,
		       i.total_amount, i.paid_amount, i.due_date
		FROM invoices i
		LEFT JOIN customers c ON c.id = i.customer_id AND c.deleted_at IS NULL
		WHERE i.company_id = ? AND i.deleted_at IS NULL
		  AND i.status IN ('sent', 'partial', 'overdue', 'draft')
		  AND i.total_amount > i.paid_amount
		ORDER BY i.due_date ASC
	`, companyID).Scan(&rows)

	customerMap := map[string]*CustomerReceivable{}
	var totalOutstanding, totalOverdue, totalCurrent float64

	for _, r := range rows {
		outstanding := r.TotalAmount - r.PaidAmount
		if outstanding <= 0 {
			continue
		}

		key := r.CustomerID
		if key == "" {
			key = "unknown"
		}

		cr, exists := customerMap[key]
		if !exists {
			name := r.FirstName + " " + r.LastName
			if name == " " {
				name = "Unknown Customer"
			}
			cr = &CustomerReceivable{
				CustomerID:   key,
				CustomerName: name,
				CompanyName:  r.CompanyName,
			}
			customerMap[key] = cr
		}

		cr.TotalAmount += r.TotalAmount
		cr.PaidAmount += r.PaidAmount
		cr.Outstanding += outstanding
		cr.InvoiceCount++

		daysOverdue := int(math.Floor(now.Sub(r.DueDate).Hours() / 24))
		if daysOverdue <= 0 {
			cr.Current += outstanding
			totalCurrent += outstanding
		} else if daysOverdue <= 30 {
			cr.Days30 += outstanding
			totalOverdue += outstanding
		} else if daysOverdue <= 60 {
			cr.Days60 += outstanding
			totalOverdue += outstanding
		} else {
			cr.Days90Plus += outstanding
			totalOverdue += outstanding
		}

		totalOutstanding += outstanding
	}

	customers := make([]CustomerReceivable, 0, len(customerMap))
	for _, cr := range customerMap {
		customers = append(customers, *cr)
	}

	summary := ReceivableSummary{
		TotalOutstanding: totalOutstanding,
		TotalOverdue:     totalOverdue,
		TotalCurrent:     totalCurrent,
		Customers:        customers,
	}

	return utils.SuccessResponse(c, summary)
}

func (h *ReceivableHandler) RegisterRoutes(api fiber.Router) {
	api.Get("/accounting/receivables", h.GetReceivables)
}
