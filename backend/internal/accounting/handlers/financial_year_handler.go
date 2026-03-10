package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	"github.com/gonext/accounting-ecommerce/internal/common/export"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FinancialYearHandler struct {
	db *gorm.DB
}

func NewFinancialYearHandler(db *gorm.DB) *FinancialYearHandler {
	return &FinancialYearHandler{db: db}
}

type CreateFinancialYearRequest struct {
	Name      string `json:"name"`
	Code      string `json:"code"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

func (h *FinancialYearHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var years []accModels.FinancialYear
	var total int64

	query := h.db.Where("company_id = ?", companyID)
	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("name ILIKE ? OR code ILIKE ?", search, search)
	}

	query.Model(&accModels.FinancialYear{}).Count(&total)

	err := query.Preload("Periods").
		Order(params.SortBy + " " + params.SortOrder).
		Scopes(utils.Paginate(params)).
		Find(&years).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch financial years")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(years, total, params))
}

func (h *FinancialYearHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var year accModels.FinancialYear
	err := h.db.Preload("Periods").Where("id = ? AND company_id = ?", id, companyID).First(&year).Error
	if err != nil {
		return utils.NotFoundResponse(c, "Financial year not found")
	}

	return utils.SuccessResponse(c, year)
}

func (h *FinancialYearHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreateFinancialYearRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Name == "" || req.Code == "" || req.StartDate == "" || req.EndDate == "" {
		return utils.BadRequestResponse(c, "All fields are required")
	}

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid start date format (use YYYY-MM-DD)")
	}
	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid end date format (use YYYY-MM-DD)")
	}

	if !endDate.After(startDate) {
		return utils.BadRequestResponse(c, "End date must be after start date")
	}

	tx := h.db.Begin()

	fy := accModels.FinancialYear{
		CompanyID: companyID,
		Name:      req.Name,
		Code:      req.Code,
		StartDate: startDate,
		EndDate:   endDate,
		IsActive:  true,
	}

	if err := tx.Create(&fy).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create financial year")
	}

	// Auto-generate monthly periods
	periodStart := startDate
	periodNum := 1
	for periodStart.Before(endDate) {
		periodEnd := periodStart.AddDate(0, 1, -1)
		if periodEnd.After(endDate) {
			periodEnd = endDate
		}

		period := accModels.FiscalPeriod{
			FinancialYearID: fy.ID,
			Name:            periodStart.Format("January 2006"),
			Number:          periodNum,
			StartDate:       periodStart,
			EndDate:         periodEnd,
		}

		if err := tx.Create(&period).Error; err != nil {
			tx.Rollback()
			return utils.InternalErrorResponse(c, "Failed to create fiscal period")
		}

		periodStart = periodEnd.AddDate(0, 0, 1)
		periodNum++
	}

	tx.Commit()

	h.db.Preload("Periods").First(&fy, "id = ?", fy.ID)
	return utils.CreatedResponse(c, fy)
}

func (h *FinancialYearHandler) Close(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var fy accModels.FinancialYear
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&fy).Error; err != nil {
		return utils.NotFoundResponse(c, "Financial year not found")
	}

	if fy.IsClosed {
		return utils.BadRequestResponse(c, "Financial year is already closed")
	}

	fy.IsClosed = true
	fy.IsActive = false
	if err := h.db.Save(&fy).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to close financial year")
	}

	h.db.Model(&accModels.FiscalPeriod{}).Where("financial_year_id = ?", id).Update("is_closed", true)

	return utils.SuccessResponse(c, fy, "Financial year closed successfully")
}

func (h *FinancialYearHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var fy accModels.FinancialYear
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&fy).Error; err != nil {
		return utils.NotFoundResponse(c, "Financial year not found")
	}

	var journalCount int64
	h.db.Model(&accModels.Journal{}).Where("financial_year_id = ?", id).Count(&journalCount)
	if journalCount > 0 {
		return utils.BadRequestResponse(c, "Cannot delete financial year with journal entries")
	}

	h.db.Where("financial_year_id = ?", id).Delete(&accModels.FiscalPeriod{})
	if err := h.db.Delete(&fy).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete financial year")
	}

	return utils.SuccessResponse(c, nil, "Financial year deleted successfully")
}

func (h *FinancialYearHandler) Export(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var years []accModels.FinancialYear
	h.db.Where("company_id = ?", companyID).Order("start_date desc").Find(&years)
	cols := []export.Column{
		{Header: "Name", Field: "Name", Width: 25},
		{Header: "Code", Field: "Code", Width: 12},
		{Header: "Start", Field: "StartDate", Width: 15},
		{Header: "End", Field: "EndDate", Width: 15},
		{Header: "Closed", Field: "IsClosed", Width: 10},
	}
	return export.HandleExport(c, "FinancialYears", cols, years)
}

func (h *FinancialYearHandler) RegisterRoutes(api fiber.Router) {
	fy := api.Group("/accounting/financial-years")
	fy.Get("/", h.List)
	fy.Get("/export", h.Export)
	fy.Get("/:id", h.Get)
	fy.Post("/", h.Create)
	fy.Post("/:id/close", h.Close)
	fy.Delete("/:id", h.Delete)
}
