package handlers

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/autonumber"
	"github.com/gonext/accounting-ecommerce/internal/common/export"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	intModels "github.com/gonext/accounting-ecommerce/internal/integration/models"
	intService "github.com/gonext/accounting-ecommerce/internal/integration/service"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrderHandler struct {
	db          *gorm.DB
	autoNum     *autonumber.Service
	integration *intService.IntegrationService
}

func NewOrderHandler(db *gorm.DB, autoNum *autonumber.Service, integration *intService.IntegrationService) *OrderHandler {
	return &OrderHandler{db: db, autoNum: autoNum, integration: integration}
}

type CreateOrderRequest struct {
	CustomerID      *string            `json:"customer_id"`
	OrderDate       string             `json:"order_date"`
	CurrencyCode    string             `json:"currency_code"`
	ShippingAmount  float64            `json:"shipping_amount"`
	DiscountAmount  float64            `json:"discount_amount"`
	Notes           string             `json:"notes"`
	ShippingName    string             `json:"shipping_name"`
	ShippingAddr    string             `json:"shipping_address"`
	ShippingCity    string             `json:"shipping_city"`
	ShippingState   string             `json:"shipping_state"`
	ShippingZip     string             `json:"shipping_zip"`
	ShippingCountry string             `json:"shipping_country"`
	Items           []OrderItemRequest `json:"items"`
}

type OrderItemRequest struct {
	ProductID string  `json:"product_id"`
	VariantID *string `json:"variant_id"`
	Quantity  int     `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
	Discount  float64 `json:"discount"`
}

func (h *OrderHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var orders []ecomModels.Order
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("order_number ILIKE ?", search)
	}

	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}
	paymentStatus := c.Query("payment_status")
	if paymentStatus != "" {
		query = query.Where("payment_status = ?", paymentStatus)
	}

	query.Model(&ecomModels.Order{}).Count(&total)

	err := query.
		Preload("Customer").
		Preload("Items.Product").
		Order(params.SortBy + " " + params.SortOrder).
		Scopes(utils.Paginate(params)).
		Find(&orders).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch orders")
	}
	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(orders, total, params))
}

func (h *OrderHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var order ecomModels.Order
	err := h.db.
		Preload("Customer").
		Preload("Items.Product").
		Preload("Payments").
		Where("id = ? AND company_id = ?", id, companyID).First(&order).Error
	if err != nil {
		return utils.NotFoundResponse(c, "Order not found")
	}
	return utils.SuccessResponse(c, order)
}

func (h *OrderHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreateOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if len(req.Items) == 0 {
		return utils.BadRequestResponse(c, "At least one item is required")
	}

	orderDate := time.Now()
	if req.OrderDate != "" {
		parsed, err := time.Parse("2006-01-02", req.OrderDate)
		if err == nil {
			orderDate = parsed
		}
	}

	orderNumber, err := h.autoNum.GenerateNumber(companyID, nil, "order")
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate order number")
	}

	currencyCode := req.CurrencyCode
	if currencyCode == "" {
		currencyCode = "USD"
	}

	tx := h.db.Begin()

	order := ecomModels.Order{
		CompanyID:       companyID,
		OrderNumber:     orderNumber,
		OrderDate:       orderDate,
		Status:          ecomModels.OrderStatusPending,
		PaymentStatus:   ecomModels.PaymentStatusUnpaid,
		CurrencyCode:    currencyCode,
		ShippingAmount:  req.ShippingAmount,
		DiscountAmount:  req.DiscountAmount,
		Notes:           req.Notes,
		ShippingName:    req.ShippingName,
		ShippingAddr:    req.ShippingAddr,
		ShippingCity:    req.ShippingCity,
		ShippingState:   req.ShippingState,
		ShippingZip:     req.ShippingZip,
		ShippingCountry: req.ShippingCountry,
	}

	if req.CustomerID != nil && *req.CustomerID != "" {
		custUUID, err := uuid.Parse(*req.CustomerID)
		if err == nil {
			order.CustomerID = &custUUID
		}
	}

	if err := tx.Create(&order).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create order")
	}

	var subtotal, taxTotal float64
	for i, item := range req.Items {
		prodUUID, err := uuid.Parse(item.ProductID)
		if err != nil {
			tx.Rollback()
			return utils.BadRequestResponse(c, fmt.Sprintf("Invalid product ID on line %d", i+1))
		}

		var product ecomModels.Product
		if err := tx.Where("id = ? AND company_id = ?", prodUUID, companyID).First(&product).Error; err != nil {
			tx.Rollback()
			return utils.BadRequestResponse(c, fmt.Sprintf("Product not found on line %d", i+1))
		}

		qty := item.Quantity
		if qty <= 0 {
			qty = 1
		}

		unitPrice := item.UnitPrice
		if unitPrice == 0 {
			unitPrice = product.Price
		}

		lineTotal := float64(qty)*unitPrice - item.Discount
		taxAmt := lineTotal * product.TaxRate / 100

		orderItem := ecomModels.OrderItem{
			OrderID:     order.ID,
			ProductID:   prodUUID,
			SKU:         product.SKU,
			Name:        product.Name,
			Quantity:    qty,
			UnitPrice:   unitPrice,
			CostPrice:   product.CostPrice,
			TaxRate:     product.TaxRate,
			TaxAmount:   taxAmt,
			Discount:    item.Discount,
			TotalAmount: lineTotal + taxAmt,
			LineNumber:  i + 1,
		}

		if item.VariantID != nil && *item.VariantID != "" {
			varUUID, err := uuid.Parse(*item.VariantID)
			if err == nil {
				orderItem.VariantID = &varUUID
			}
		}

		if err := tx.Create(&orderItem).Error; err != nil {
			tx.Rollback()
			return utils.InternalErrorResponse(c, "Failed to create order item")
		}

		// Deduct stock
		if product.TrackStock {
			tx.Model(&ecomModels.Product{}).Where("id = ?", prodUUID).
				Update("stock_quantity", gorm.Expr("stock_quantity - ?", qty))
		}

		subtotal += lineTotal
		taxTotal += taxAmt
	}

	order.Subtotal = subtotal
	order.TaxAmount = taxTotal
	order.TotalAmount = subtotal + taxTotal + req.ShippingAmount - req.DiscountAmount

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to update order totals")
	}

	tx.Commit()

	h.db.Preload("Customer").Preload("Items.Product").First(&order, "id = ?", order.ID)
	return utils.CreatedResponse(c, order)
}

func (h *OrderHandler) UpdateStatus(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var order ecomModels.Order
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&order).Error; err != nil {
		return utils.NotFoundResponse(c, "Order not found")
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	oldStatus := string(order.Status)
	order.Status = ecomModels.OrderStatus(body.Status)
	if err := h.db.Save(&order).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update order status")
	}

	// Record status history
	userID, _ := c.Locals("user_id").(uuid.UUID)
	history := ecomModels.OrderStatusHistory{
		OrderID:   order.ID,
		Status:    body.Status,
		Notes:     fmt.Sprintf("Status changed from %s to %s", oldStatus, body.Status),
		ChangedBy: &userID,
		ChangedAt: time.Now(),
	}
	h.db.Create(&history)

	// Trigger integration
	if h.integration != nil {
		var eventType intModels.EventType
		switch order.Status {
		case ecomModels.OrderStatusConfirmed:
			eventType = intModels.EventOrderConfirmed
		case ecomModels.OrderStatusShipped:
			eventType = intModels.EventOrderShipped
		case ecomModels.OrderStatusDelivered:
			eventType = intModels.EventOrderDelivered
		case ecomModels.OrderStatusCancelled:
			eventType = intModels.EventOrderCancelled
		}
		if eventType != "" {
			_ = h.integration.ProcessOrderEvent(companyID, eventType, &order)
		}
	}

	return utils.SuccessResponse(c, order, "Order status updated")
}

func (h *OrderHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var order ecomModels.Order
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&order).Error; err != nil {
		return utils.NotFoundResponse(c, "Order not found")
	}

	if order.Status != ecomModels.OrderStatusPending {
		return utils.BadRequestResponse(c, "Only pending orders can be deleted")
	}

	h.db.Where("order_id = ?", id).Delete(&ecomModels.OrderItem{})
	if err := h.db.Delete(&order).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete order")
	}
	return utils.SuccessResponse(c, nil, "Order deleted successfully")
}

func (h *OrderHandler) Export(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var orders []ecomModels.Order
	query := h.db.Where("company_id = ?", companyID).Preload("Customer")
	if s := c.Query("search"); s != "" {
		query = query.Where("order_number ILIKE ?", "%"+s+"%")
	}
	query.Order("created_at desc").Find(&orders)
	cols := []export.Column{
		{Header: "Order #", Field: "OrderNumber", Width: 15},
		{Header: "Date", Field: "OrderDate", Width: 15},
		{Header: "Status", Field: "Status", Width: 12},
		{Header: "Total", Field: "TotalAmount", Width: 12},
		{Header: "Paid", Field: "PaidAmount", Width: 12},
		{Header: "Payment", Field: "PaymentStatus", Width: 12},
	}
	return export.HandleExport(c, "Orders", cols, orders)
}

func (h *OrderHandler) GetStatusHistory(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	orderID := c.Params("id")

	var order ecomModels.Order
	if err := h.db.Where("id = ? AND company_id = ?", orderID, companyID).First(&order).Error; err != nil {
		return utils.NotFoundResponse(c, "Order not found")
	}

	var history []ecomModels.OrderStatusHistory
	h.db.Where("order_id = ?", orderID).Order("changed_at asc").Find(&history)
	return utils.SuccessResponse(c, history)
}

func (h *OrderHandler) RegisterRoutes(api fiber.Router) {
	orders := api.Group("/ecommerce/orders")
	orders.Get("/", h.List)
	orders.Get("/export", h.Export)
	orders.Get("/:id", h.Get)
	orders.Get("/:id/history", h.GetStatusHistory)
	orders.Post("/", h.Create)
	orders.Put("/:id/status", h.UpdateStatus)
	orders.Delete("/:id", h.Delete)
}
