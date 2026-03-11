package orders

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/ecommerce/internal/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

// Read-only structs for existing tables
type Order struct {
	ID              uuid.UUID   `json:"id"`
	CreatedAt       time.Time   `json:"created_at"`
	CustomerID      *uuid.UUID  `json:"customer_id"`
	OrderNumber     string      `json:"order_number"`
	OrderDate       time.Time   `json:"order_date"`
	Status          string      `json:"status"`
	PaymentStatus   string      `json:"payment_status"`
	CurrencyCode    string      `json:"currency_code"`
	Subtotal        float64     `json:"subtotal"`
	TaxAmount       float64     `json:"tax_amount"`
	ShippingAmount  float64     `json:"shipping_amount"`
	DiscountAmount  float64     `json:"discount_amount"`
	TotalAmount     float64     `json:"total_amount"`
	PaidAmount      float64     `json:"paid_amount"`
	Notes           string      `json:"notes"`
	ShippingName    string      `json:"shipping_name"`
	ShippingAddr    string      `json:"shipping_address"`
	ShippingCity    string      `json:"shipping_city"`
	ShippingState   string      `json:"shipping_state"`
	ShippingZip     string      `json:"shipping_zip"`
	ShippingCountry string      `json:"shipping_country"`
	Items           []OrderItem `json:"items,omitempty" gorm:"foreignKey:OrderID"`
}

func (Order) TableName() string { return "orders" }

type OrderItem struct {
	ID          uuid.UUID  `json:"id"`
	OrderID     uuid.UUID  `json:"order_id"`
	ProductID   uuid.UUID  `json:"product_id"`
	VariantID   *uuid.UUID `json:"variant_id"`
	SKU         string     `json:"sku"`
	Name        string     `json:"name"`
	Quantity    int        `json:"quantity"`
	UnitPrice   float64    `json:"unit_price"`
	TaxRate     float64    `json:"tax_rate"`
	TaxAmount   float64    `json:"tax_amount"`
	Discount    float64    `json:"discount"`
	TotalAmount float64    `json:"total_amount"`
	LineNumber  int        `json:"line_number"`
}

func (OrderItem) TableName() string { return "order_items" }

func (h *Handler) ListOrders(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var orders []Order
	var total int64

	storeTag := fmt.Sprintf("[store_customer:%s]", customerID.String())
	query := h.db.Where("notes LIKE ?", "%"+storeTag+"%")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	query.Model(&Order{}).Count(&total)

	offset := (params.Page - 1) * params.PageSize
	err := query.Preload("Items").
		Order("order_date DESC").
		Offset(offset).Limit(params.PageSize).
		Find(&orders).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch orders")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(orders, total, params))
}

func (h *Handler) GetOrder(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)
	orderID := c.Params("id")

	var order Order
	storeTag := fmt.Sprintf("[store_customer:%s]", customerID.String())
	err := h.db.Where("id = ? AND notes LIKE ?", orderID, "%"+storeTag+"%").
		Preload("Items").
		First(&order).Error
	if err != nil {
		return utils.NotFoundResponse(c, "Order not found")
	}

	return utils.SuccessResponse(c, order)
}

func (h *Handler) RegisterRoutes(api fiber.Router) {
	orders := api.Group("/store/orders")
	orders.Get("/", h.ListOrders)
	orders.Get("/:id", h.GetOrder)
}
