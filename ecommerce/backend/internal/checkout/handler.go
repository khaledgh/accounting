package checkout

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/ecommerce/internal/models"
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

type CheckoutRequest struct {
	ShippingAddressID string `json:"shipping_address_id"`
	Notes             string `json:"notes"`
	PaymentMethod     string `json:"payment_method"`
}

func (h *Handler) PlaceOrder(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	var req CheckoutRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	// Get cart
	var cart models.StoreCart
	if err := h.db.Where("customer_id = ?", customerID).Preload("Items").First(&cart).Error; err != nil {
		return utils.BadRequestResponse(c, "Cart not found")
	}

	if len(cart.Items) == 0 {
		return utils.BadRequestResponse(c, "Cart is empty")
	}

	// Get shipping address
	var address models.StoreAddress
	if req.ShippingAddressID != "" {
		if err := h.db.Where("id = ? AND customer_id = ?", req.ShippingAddressID, customerID).First(&address).Error; err != nil {
			return utils.BadRequestResponse(c, "Shipping address not found")
		}
	}

	tx := h.db.Begin()

	// Build order items and calculate totals
	var subtotal float64
	var taxAmount float64
	var orderItems []map[string]interface{}

	for i, item := range cart.Items {
		var product struct {
			ID            uuid.UUID
			SKU           string
			Name          string
			Price         float64
			CostPrice     float64
			TaxRate       float64
			StockQuantity int
			TrackStock    bool
		}
		if err := tx.Table("products").Where("id = ? AND is_active = ?", item.ProductID, true).Scan(&product).Error; err != nil {
			tx.Rollback()
			return utils.BadRequestResponse(c, fmt.Sprintf("Product not found: %s", item.ProductID))
		}

		if product.TrackStock && product.StockQuantity < item.Quantity {
			tx.Rollback()
			return utils.BadRequestResponse(c, fmt.Sprintf("Insufficient stock for %s", product.Name))
		}

		itemTax := product.Price * float64(item.Quantity) * product.TaxRate / 100
		itemTotal := product.Price*float64(item.Quantity) + itemTax

		subtotal += product.Price * float64(item.Quantity)
		taxAmount += itemTax

		orderItems = append(orderItems, map[string]interface{}{
			"id":           uuid.New(),
			"product_id":   product.ID,
			"variant_id":   item.VariantID,
			"sku":          product.SKU,
			"name":         product.Name,
			"quantity":     item.Quantity,
			"unit_price":   product.Price,
			"cost_price":   product.CostPrice,
			"tax_rate":     product.TaxRate,
			"tax_amount":   itemTax,
			"discount":     0,
			"total_amount": itemTotal,
			"line_number":  i + 1,
		})

		// Decrement stock
		if product.TrackStock {
			tx.Table("products").Where("id = ?", product.ID).
				Update("stock_quantity", gorm.Expr("stock_quantity - ?", item.Quantity))

			// Record stock movement
			tx.Table("stock_movements").Create(map[string]interface{}{
				"id":             uuid.New(),
				"company_id":     getCompanyID(tx),
				"product_id":     product.ID,
				"quantity":       -item.Quantity,
				"type":           "sale",
				"reference_type": "storefront_order",
				"notes":          "Storefront order",
				"created_at":     time.Now(),
				"updated_at":     time.Now(),
			})
		}
	}

	totalAmount := subtotal + taxAmount

	// Generate order number
	orderNumber := fmt.Sprintf("SO-%s", time.Now().Format("20060102150405"))

	// Create order
	orderID := uuid.New()
	companyID := getCompanyID(tx)

	// Build notes with store customer reference
	orderNotes := req.Notes
	if orderNotes != "" {
		orderNotes += "\n"
	}
	orderNotes += fmt.Sprintf("[store_customer:%s]", customerID.String())

	orderData := map[string]interface{}{
		"id":               orderID,
		"company_id":       companyID,
		"order_number":     orderNumber,
		"order_date":       time.Now(),
		"status":           "pending",
		"payment_status":   "unpaid",
		"currency_code":    "USD",
		"subtotal":         subtotal,
		"tax_amount":       taxAmount,
		"shipping_amount":  0,
		"discount_amount":  0,
		"total_amount":     totalAmount,
		"paid_amount":      0,
		"notes":            orderNotes,
		"shipping_name":    address.FirstName + " " + address.LastName,
		"shipping_addr":    address.Address1,
		"shipping_city":    address.City,
		"shipping_state":   address.State,
		"shipping_zip":     address.PostalCode,
		"shipping_country": address.Country,
		"created_at":       time.Now(),
		"updated_at":       time.Now(),
	}

	if err := tx.Table("orders").Create(orderData).Error; err != nil {
		tx.Rollback()
		fmt.Printf("Checkout: Failed to create order: %v\n", err)
		return utils.InternalErrorResponse(c, "Failed to create order")
	}

	// Create order items
	for _, item := range orderItems {
		item["order_id"] = orderID
		item["created_at"] = time.Now()
		item["updated_at"] = time.Now()
		if err := tx.Table("order_items").Create(item).Error; err != nil {
			tx.Rollback()
			fmt.Printf("Checkout: Failed to create order item: %v\n", err)
			return utils.InternalErrorResponse(c, "Failed to create order items")
		}
	}

	// Clear cart
	tx.Where("cart_id = ?", cart.ID).Delete(&models.StoreCartItem{})

	if err := tx.Commit().Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to complete order")
	}

	return utils.CreatedResponse(c, fiber.Map{
		"order_id":     orderID,
		"order_number": orderNumber,
		"total_amount": totalAmount,
		"status":       "pending",
		"message":      "Order placed successfully",
	})
}

func (h *Handler) RegisterRoutes(api fiber.Router) {
	api.Post("/store/checkout", h.PlaceOrder)
}

func getCompanyID(db *gorm.DB) uuid.UUID {
	var result struct {
		ID uuid.UUID
	}
	db.Table("companies").Select("id").Limit(1).Scan(&result)
	return result.ID
}
