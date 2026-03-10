package handlers

import (
	"github.com/gofiber/fiber/v2"
	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CurrencyHandler struct {
	db *gorm.DB
}

func NewCurrencyHandler(db *gorm.DB) *CurrencyHandler {
	return &CurrencyHandler{db: db}
}

// ── Currency CRUD ───────────────────────────────────────────────────

func (h *CurrencyHandler) ListCurrencies(c *fiber.Ctx) error {
	params := utils.GetPaginationParams(c)

	var currencies []accModels.Currency
	var total int64

	query := h.db.Model(&accModels.Currency{})

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("code ILIKE ? OR name ILIKE ?", search, search)
	}

	query.Count(&total)

	err := query.
		Order(params.SortBy + " " + params.SortOrder).
		Scopes(utils.Paginate(params)).
		Find(&currencies).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch currencies")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(currencies, total, params))
}

func (h *CurrencyHandler) GetCurrency(c *fiber.Ctx) error {
	id := c.Params("id")

	var currency accModels.Currency
	if err := h.db.Where("id = ?", id).First(&currency).Error; err != nil {
		return utils.NotFoundResponse(c, "Currency not found")
	}

	return utils.SuccessResponse(c, currency)
}

type CreateCurrencyRequest struct {
	Code          string `json:"code"`
	Name          string `json:"name"`
	Symbol        string `json:"symbol"`
	DecimalPlaces int    `json:"decimal_places"`
}

func (h *CurrencyHandler) CreateCurrency(c *fiber.Ctx) error {
	var req CreateCurrencyRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Code == "" || req.Name == "" || req.Symbol == "" {
		return utils.BadRequestResponse(c, "Code, name and symbol are required")
	}

	var existing accModels.Currency
	if err := h.db.Where("code = ?", req.Code).First(&existing).Error; err == nil {
		return utils.BadRequestResponse(c, "Currency code already exists")
	}

	dp := req.DecimalPlaces
	if dp == 0 {
		dp = 2
	}

	currency := accModels.Currency{
		Code:          req.Code,
		Name:          req.Name,
		Symbol:        req.Symbol,
		DecimalPlaces: dp,
		IsActive:      true,
	}

	if err := h.db.Create(&currency).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create currency")
	}

	return utils.CreatedResponse(c, currency)
}

func (h *CurrencyHandler) UpdateCurrency(c *fiber.Ctx) error {
	id := c.Params("id")

	var currency accModels.Currency
	if err := h.db.Where("id = ?", id).First(&currency).Error; err != nil {
		return utils.NotFoundResponse(c, "Currency not found")
	}

	var req CreateCurrencyRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Symbol != "" {
		updates["symbol"] = req.Symbol
	}
	if req.DecimalPlaces > 0 {
		updates["decimal_places"] = req.DecimalPlaces
	}

	if err := h.db.Model(&currency).Updates(updates).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update currency")
	}

	h.db.First(&currency, "id = ?", id)
	return utils.SuccessResponse(c, currency, "Currency updated successfully")
}

func (h *CurrencyHandler) DeleteCurrency(c *fiber.Ctx) error {
	id := c.Params("id")

	var currency accModels.Currency
	if err := h.db.Where("id = ?", id).First(&currency).Error; err != nil {
		return utils.NotFoundResponse(c, "Currency not found")
	}

	if currency.IsDefault {
		return utils.BadRequestResponse(c, "Cannot delete default currency")
	}

	if err := h.db.Delete(&currency).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete currency")
	}

	return utils.SuccessResponse(c, nil, "Currency deleted successfully")
}

// ── Exchange Rate CRUD ──────────────────────────────────────────────

func (h *CurrencyHandler) ListExchangeRates(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var rates []accModels.ExchangeRate
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	from := c.Query("from_currency")
	if from != "" {
		query = query.Where("from_currency = ?", from)
	}
	to := c.Query("to_currency")
	if to != "" {
		query = query.Where("to_currency = ?", to)
	}

	query.Model(&accModels.ExchangeRate{}).Count(&total)

	err := query.
		Order("effective_date DESC").
		Scopes(utils.Paginate(params)).
		Find(&rates).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch exchange rates")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(rates, total, params))
}

type CreateExchangeRateRequest struct {
	FromCurrency  string  `json:"from_currency"`
	ToCurrency    string  `json:"to_currency"`
	Rate          float64 `json:"rate"`
	EffectiveDate string  `json:"effective_date"`
}

func (h *CurrencyHandler) CreateExchangeRate(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreateExchangeRateRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.FromCurrency == "" || req.ToCurrency == "" || req.Rate <= 0 || req.EffectiveDate == "" {
		return utils.BadRequestResponse(c, "From currency, to currency, rate and effective date are required")
	}

	rate := accModels.ExchangeRate{
		CompanyID:     companyID,
		FromCurrency:  req.FromCurrency,
		ToCurrency:    req.ToCurrency,
		Rate:          req.Rate,
		EffectiveDate: req.EffectiveDate,
	}

	if err := h.db.Create(&rate).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create exchange rate")
	}

	return utils.CreatedResponse(c, rate)
}

func (h *CurrencyHandler) DeleteExchangeRate(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var rate accModels.ExchangeRate
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&rate).Error; err != nil {
		return utils.NotFoundResponse(c, "Exchange rate not found")
	}

	if err := h.db.Delete(&rate).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete exchange rate")
	}

	return utils.SuccessResponse(c, nil, "Exchange rate deleted successfully")
}

// ── Routes ──────────────────────────────────────────────────────────

func (h *CurrencyHandler) RegisterRoutes(api fiber.Router) {
	currencies := api.Group("/accounting/currencies")
	currencies.Get("/", h.ListCurrencies)
	currencies.Get("/:id", h.GetCurrency)
	currencies.Post("/", h.CreateCurrency)
	currencies.Put("/:id", h.UpdateCurrency)
	currencies.Delete("/:id", h.DeleteCurrency)

	rates := api.Group("/accounting/exchange-rates")
	rates.Get("/", h.ListExchangeRates)
	rates.Post("/", h.CreateExchangeRate)
	rates.Delete("/:id", h.DeleteExchangeRate)
}
