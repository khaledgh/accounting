package customer

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

type UpdateProfileRequest struct {
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Phone     *string `json:"phone"`
}

type AddressRequest struct {
	Label      string `json:"label"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Phone      string `json:"phone"`
	Address1   string `json:"address1"`
	Address2   string `json:"address2"`
	City       string `json:"city"`
	State      string `json:"state"`
	PostalCode string `json:"postal_code"`
	Country    string `json:"country"`
	IsDefault  bool   `json:"is_default"`
}

func (h *Handler) GetProfile(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	var customer models.StoreCustomer
	if err := h.db.First(&customer, "id = ?", customerID).Error; err != nil {
		return utils.NotFoundResponse(c, "Customer not found")
	}

	return utils.SuccessResponse(c, customer)
}

func (h *Handler) UpdateProfile(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	var req UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	updates := map[string]interface{}{}
	if req.FirstName != nil {
		updates["first_name"] = *req.FirstName
	}
	if req.LastName != nil {
		updates["last_name"] = *req.LastName
	}
	if req.Phone != nil {
		updates["phone"] = *req.Phone
	}

	if err := h.db.Model(&models.StoreCustomer{}).Where("id = ?", customerID).Updates(updates).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update profile")
	}

	var customer models.StoreCustomer
	h.db.First(&customer, "id = ?", customerID)
	return utils.SuccessResponse(c, customer, "Profile updated")
}

func (h *Handler) ListAddresses(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	var addresses []models.StoreAddress
	h.db.Where("customer_id = ?", customerID).Order("is_default DESC, created_at ASC").Find(&addresses)
	return utils.SuccessResponse(c, addresses)
}

func (h *Handler) CreateAddress(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	var req AddressRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.FirstName == "" || req.Address1 == "" || req.City == "" || req.PostalCode == "" {
		return utils.BadRequestResponse(c, "First name, address, city and postal code are required")
	}

	if req.IsDefault {
		h.db.Model(&models.StoreAddress{}).Where("customer_id = ?", customerID).Update("is_default", false)
	}

	address := models.StoreAddress{
		CustomerID: customerID,
		Label:      req.Label,
		FirstName:  req.FirstName,
		LastName:   req.LastName,
		Phone:      req.Phone,
		Address1:   req.Address1,
		Address2:   req.Address2,
		City:       req.City,
		State:      req.State,
		PostalCode: req.PostalCode,
		Country:    req.Country,
		IsDefault:  req.IsDefault,
	}

	if err := h.db.Create(&address).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create address")
	}

	return utils.CreatedResponse(c, address)
}

func (h *Handler) UpdateAddress(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)
	id := c.Params("id")

	var address models.StoreAddress
	if err := h.db.Where("id = ? AND customer_id = ?", id, customerID).First(&address).Error; err != nil {
		return utils.NotFoundResponse(c, "Address not found")
	}

	var req AddressRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.IsDefault {
		h.db.Model(&models.StoreAddress{}).Where("customer_id = ? AND id != ?", customerID, id).Update("is_default", false)
	}

	h.db.Model(&address).Updates(map[string]interface{}{
		"label": req.Label, "first_name": req.FirstName, "last_name": req.LastName,
		"phone": req.Phone, "address1": req.Address1, "address2": req.Address2,
		"city": req.City, "state": req.State, "postal_code": req.PostalCode,
		"country": req.Country, "is_default": req.IsDefault,
	})

	h.db.First(&address, "id = ?", id)
	return utils.SuccessResponse(c, address, "Address updated")
}

func (h *Handler) DeleteAddress(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)
	id := c.Params("id")

	result := h.db.Where("id = ? AND customer_id = ?", id, customerID).Delete(&models.StoreAddress{})
	if result.RowsAffected == 0 {
		return utils.NotFoundResponse(c, "Address not found")
	}
	return utils.SuccessResponse(c, nil, "Address deleted")
}

// Wishlist
func (h *Handler) GetWishlist(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	type WishlistItem struct {
		models.StoreWishlist
		ProductName  string  `json:"product_name"`
		ProductPrice float64 `json:"product_price"`
		ProductImage string  `json:"product_image"`
		ProductSlug  string  `json:"product_slug"`
	}

	var wishlists []models.StoreWishlist
	h.db.Where("customer_id = ?", customerID).Order("created_at DESC").Find(&wishlists)

	var items []WishlistItem
	for _, w := range wishlists {
		var product struct {
			Name     string
			Price    float64
			ImageURL string
			Slug     string
		}
		h.db.Table("products").Select("name, price, image_url, slug").Where("id = ?", w.ProductID).Scan(&product)
		items = append(items, WishlistItem{
			StoreWishlist: w,
			ProductName:   product.Name,
			ProductPrice:  product.Price,
			ProductImage:  product.ImageURL,
			ProductSlug:   product.Slug,
		})
	}

	return utils.SuccessResponse(c, items)
}

func (h *Handler) AddToWishlist(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	var req struct {
		ProductID string `json:"product_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	productID, err := uuid.Parse(req.ProductID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid product ID")
	}

	var existing models.StoreWishlist
	if err := h.db.Where("customer_id = ? AND product_id = ?", customerID, productID).First(&existing).Error; err == nil {
		return utils.BadRequestResponse(c, "Product already in wishlist")
	}

	wishlist := models.StoreWishlist{CustomerID: customerID, ProductID: productID}
	if err := h.db.Create(&wishlist).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to add to wishlist")
	}

	return utils.CreatedResponse(c, wishlist)
}

func (h *Handler) RemoveFromWishlist(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)
	id := c.Params("id")

	result := h.db.Where("id = ? AND customer_id = ?", id, customerID).Delete(&models.StoreWishlist{})
	if result.RowsAffected == 0 {
		return utils.NotFoundResponse(c, "Wishlist item not found")
	}
	return utils.SuccessResponse(c, nil, "Removed from wishlist")
}

// Favorites (toggle pattern — many-to-many with compound index)
func (h *Handler) ToggleFavorite(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	var req struct {
		ProductID string `json:"product_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	productID, err := uuid.Parse(req.ProductID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid product ID")
	}

	var existing models.StoreFavorite
	result := h.db.Where("customer_id = ? AND product_id = ?", customerID, productID).First(&existing)
	if result.Error == nil {
		// Already favorited — remove it (toggle off)
		h.db.Unscoped().Delete(&existing)
		return utils.SuccessResponse(c, fiber.Map{"favorited": false}, "Removed from favorites")
	}

	// Not favorited — add it (toggle on)
	fav := models.StoreFavorite{CustomerID: customerID, ProductID: productID}
	if err := h.db.Create(&fav).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to toggle favorite")
	}
	return utils.SuccessResponse(c, fiber.Map{"favorited": true, "id": fav.ID}, "Added to favorites")
}

func (h *Handler) GetFavorites(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)

	type FavoriteItem struct {
		models.StoreFavorite
		ProductName  string  `json:"product_name"`
		ProductPrice float64 `json:"product_price"`
		ProductImage string  `json:"product_image"`
		ProductSlug  string  `json:"product_slug"`
	}

	var favs []models.StoreFavorite
	h.db.Where("customer_id = ?", customerID).Order("created_at DESC").Find(&favs)

	items := make([]FavoriteItem, 0, len(favs))
	for _, f := range favs {
		var product struct {
			Name     string
			Price    float64
			ImageURL string
			Slug     string
		}
		h.db.Table("products").Select("name, price, image_url, slug").Where("id = ?", f.ProductID).Scan(&product)
		items = append(items, FavoriteItem{
			StoreFavorite: f,
			ProductName:   product.Name,
			ProductPrice:  product.Price,
			ProductImage:  product.ImageURL,
			ProductSlug:   product.Slug,
		})
	}

	return utils.SuccessResponse(c, items)
}

func (h *Handler) GetFavoriteIDs(c *fiber.Ctx) error {
	customerID := c.Locals("customer_id").(uuid.UUID)
	var ids []uuid.UUID
	h.db.Model(&models.StoreFavorite{}).Where("customer_id = ?", customerID).Pluck("product_id", &ids)
	return utils.SuccessResponse(c, ids)
}

func (h *Handler) RegisterRoutes(api fiber.Router) {
	profile := api.Group("/store/profile")
	profile.Get("/", h.GetProfile)
	profile.Put("/", h.UpdateProfile)

	addresses := api.Group("/store/addresses")
	addresses.Get("/", h.ListAddresses)
	addresses.Post("/", h.CreateAddress)
	addresses.Put("/:id", h.UpdateAddress)
	addresses.Delete("/:id", h.DeleteAddress)

	wishlist := api.Group("/store/wishlist")
	wishlist.Get("/", h.GetWishlist)
	wishlist.Post("/", h.AddToWishlist)
	wishlist.Delete("/:id", h.RemoveFromWishlist)

	favorites := api.Group("/store/favorites")
	favorites.Get("/", h.GetFavorites)
	favorites.Get("/ids", h.GetFavoriteIDs)
	favorites.Post("/toggle", h.ToggleFavorite)
}
