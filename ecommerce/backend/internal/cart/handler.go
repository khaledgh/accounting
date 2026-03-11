package cart

import (
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

type AddItemRequest struct {
	ProductID string  `json:"product_id"`
	VariantID *string `json:"variant_id"`
	Quantity  int     `json:"quantity"`
}

type UpdateItemRequest struct {
	Quantity int `json:"quantity"`
}

func (h *Handler) getOrCreateCart(customerID uuid.UUID) (*models.StoreCart, error) {
	var cart models.StoreCart
	err := h.db.Where("customer_id = ?", customerID).First(&cart).Error
	if err == gorm.ErrRecordNotFound {
		cart = models.StoreCart{CustomerID: customerID}
		if err := h.db.Create(&cart).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}
	return &cart, nil
}

func (h *Handler) GetCart(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	cart, err := h.getOrCreateCart(customerID)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to get cart")
	}

	h.db.Preload("Items").First(cart, "id = ?", cart.ID)

	// Enrich items with product data
	type CartItemResponse struct {
		models.StoreCartItem
		ProductName  string  `json:"product_name"`
		ProductPrice float64 `json:"product_price"`
		ProductImage string  `json:"product_image"`
		ProductSlug  string  `json:"product_slug"`
	}

	var items []CartItemResponse
	for _, item := range cart.Items {
		var product struct {
			Name     string
			Price    float64
			ImageURL string
			Slug     string
		}
		h.db.Table("products").Select("name, price, image_url, slug").Where("id = ?", item.ProductID).Scan(&product)

		items = append(items, CartItemResponse{
			StoreCartItem: item,
			ProductName:   product.Name,
			ProductPrice:  product.Price,
			ProductImage:  product.ImageURL,
			ProductSlug:   product.Slug,
		})
	}

	var totalAmount float64
	var totalItems int
	for _, item := range items {
		totalAmount += item.ProductPrice * float64(item.Quantity)
		totalItems += item.Quantity
	}

	return utils.SuccessResponse(c, fiber.Map{
		"cart_id":      cart.ID,
		"items":        items,
		"total_items":  totalItems,
		"total_amount": totalAmount,
	})
}

func (h *Handler) AddItem(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	var req AddItemRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.ProductID == "" || req.Quantity < 1 {
		return utils.BadRequestResponse(c, "Product ID and quantity (>= 1) are required")
	}

	productID, err := uuid.Parse(req.ProductID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid product ID")
	}

	// Verify product exists and is active
	var productCount int64
	h.db.Table("products").Where("id = ? AND is_active = ?", productID, true).Count(&productCount)
	if productCount == 0 {
		return utils.NotFoundResponse(c, "Product not found")
	}

	cart, err := h.getOrCreateCart(customerID)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to get cart")
	}

	// Check if product already in cart
	var existingItem models.StoreCartItem
	err = h.db.Where("cart_id = ? AND product_id = ?", cart.ID, productID).First(&existingItem).Error
	if err == nil {
		existingItem.Quantity += req.Quantity
		h.db.Save(&existingItem)
		return utils.SuccessResponse(c, existingItem, "Item quantity updated")
	}

	var variantID *uuid.UUID
	if req.VariantID != nil {
		vid, err := uuid.Parse(*req.VariantID)
		if err == nil {
			variantID = &vid
		}
	}

	item := models.StoreCartItem{
		CartID:    cart.ID,
		ProductID: productID,
		VariantID: variantID,
		Quantity:  req.Quantity,
	}

	if err := h.db.Create(&item).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to add item to cart")
	}

	return utils.CreatedResponse(c, item)
}

func (h *Handler) UpdateItem(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)
	itemID := c.Params("id")

	var req UpdateItemRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	cart, err := h.getOrCreateCart(customerID)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to get cart")
	}

	var item models.StoreCartItem
	if err := h.db.Where("id = ? AND cart_id = ?", itemID, cart.ID).First(&item).Error; err != nil {
		return utils.NotFoundResponse(c, "Cart item not found")
	}

	if req.Quantity < 1 {
		h.db.Delete(&item)
		return utils.SuccessResponse(c, nil, "Item removed from cart")
	}

	item.Quantity = req.Quantity
	h.db.Save(&item)
	return utils.SuccessResponse(c, item, "Item updated")
}

func (h *Handler) RemoveItem(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)
	itemID := c.Params("id")

	cart, err := h.getOrCreateCart(customerID)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to get cart")
	}

	result := h.db.Where("id = ? AND cart_id = ?", itemID, cart.ID).Delete(&models.StoreCartItem{})
	if result.RowsAffected == 0 {
		return utils.NotFoundResponse(c, "Cart item not found")
	}

	return utils.SuccessResponse(c, nil, "Item removed from cart")
}

func (h *Handler) ClearCart(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	cart, err := h.getOrCreateCart(customerID)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to get cart")
	}

	h.db.Where("cart_id = ?", cart.ID).Delete(&models.StoreCartItem{})
	return utils.SuccessResponse(c, nil, "Cart cleared")
}

func (h *Handler) RegisterRoutes(api fiber.Router) {
	cart := api.Group("/store/cart")
	cart.Get("/", h.GetCart)
	cart.Post("/items", h.AddItem)
	cart.Put("/items/:id", h.UpdateItem)
	cart.Delete("/items/:id", h.RemoveItem)
	cart.Delete("/", h.ClearCart)
}
