package handlers

import (
	"github.com/gofiber/fiber/v2"
	intModels "github.com/gonext/accounting-ecommerce/internal/integration/models"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type IntegrationHandler struct {
	db *gorm.DB
}

func NewIntegrationHandler(db *gorm.DB) *IntegrationHandler {
	return &IntegrationHandler{db: db}
}

type CreateMappingRequest struct {
	EventType       string `json:"event_type"`
	DebitAccountID  string `json:"debit_account_id"`
	CreditAccountID string `json:"credit_account_id"`
	Description     string `json:"description"`
}

type UpdateMappingRequest struct {
	DebitAccountID  *string `json:"debit_account_id"`
	CreditAccountID *string `json:"credit_account_id"`
	Description     *string `json:"description"`
	IsActive        *bool   `json:"is_active"`
}

func (h *IntegrationHandler) ListMappings(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var mappings []intModels.AccountMapping
	err := h.db.Where("company_id = ?", companyID).Order("event_type ASC").Find(&mappings).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch mappings")
	}

	return utils.SuccessResponse(c, mappings)
}

func (h *IntegrationHandler) CreateMapping(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreateMappingRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.EventType == "" || req.DebitAccountID == "" || req.CreditAccountID == "" {
		return utils.BadRequestResponse(c, "Event type, debit account and credit account are required")
	}

	debitUUID, err := uuid.Parse(req.DebitAccountID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid debit account ID")
	}
	creditUUID, err := uuid.Parse(req.CreditAccountID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid credit account ID")
	}

	var existing intModels.AccountMapping
	if err := h.db.Where("company_id = ? AND event_type = ?", companyID, req.EventType).First(&existing).Error; err == nil {
		return utils.BadRequestResponse(c, "Mapping already exists for this event type")
	}

	mapping := intModels.AccountMapping{
		CompanyID:       companyID,
		EventType:       intModels.EventType(req.EventType),
		DebitAccountID:  debitUUID,
		CreditAccountID: creditUUID,
		Description:     req.Description,
		IsActive:        true,
	}

	if err := h.db.Create(&mapping).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create mapping")
	}

	return utils.CreatedResponse(c, mapping)
}

func (h *IntegrationHandler) UpdateMapping(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var mapping intModels.AccountMapping
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&mapping).Error; err != nil {
		return utils.NotFoundResponse(c, "Mapping not found")
	}

	var req UpdateMappingRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	updates := map[string]interface{}{}
	if req.DebitAccountID != nil {
		debitUUID, err := uuid.Parse(*req.DebitAccountID)
		if err == nil {
			updates["debit_account_id"] = debitUUID
		}
	}
	if req.CreditAccountID != nil {
		creditUUID, err := uuid.Parse(*req.CreditAccountID)
		if err == nil {
			updates["credit_account_id"] = creditUUID
		}
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if err := h.db.Model(&mapping).Updates(updates).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update mapping")
	}

	h.db.First(&mapping, "id = ?", id)
	return utils.SuccessResponse(c, mapping, "Mapping updated successfully")
}

func (h *IntegrationHandler) DeleteMapping(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var mapping intModels.AccountMapping
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&mapping).Error; err != nil {
		return utils.NotFoundResponse(c, "Mapping not found")
	}

	if err := h.db.Delete(&mapping).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete mapping")
	}

	return utils.SuccessResponse(c, nil, "Mapping deleted successfully")
}

func (h *IntegrationHandler) ListLogs(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var logs []intModels.IntegrationLog
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	eventType := c.Query("event_type")
	if eventType != "" {
		query = query.Where("event_type = ?", eventType)
	}
	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Model(&intModels.IntegrationLog{}).Count(&total)

	err := query.Order("created_at DESC").Scopes(utils.Paginate(params)).Find(&logs).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch logs")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(logs, total, params))
}

func (h *IntegrationHandler) RegisterRoutes(api fiber.Router) {
	integration := api.Group("/integration")
	integration.Get("/mappings", h.ListMappings)
	integration.Post("/mappings", h.CreateMapping)
	integration.Put("/mappings/:id", h.UpdateMapping)
	integration.Delete("/mappings/:id", h.DeleteMapping)
	integration.Get("/logs", h.ListLogs)
}
