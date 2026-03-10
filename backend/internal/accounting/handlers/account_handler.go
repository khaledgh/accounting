package handlers

import (
	"github.com/gofiber/fiber/v2"
	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AccountHandler struct {
	db *gorm.DB
}

func NewAccountHandler(db *gorm.DB) *AccountHandler {
	return &AccountHandler{db: db}
}

type CreateAccountRequest struct {
	ParentID         *string `json:"parent_id"`
	Code             string  `json:"code"`
	Name             string  `json:"name"`
	AccountType      string  `json:"account_type"`
	Description      string  `json:"description"`
	CurrencyCode     string  `json:"currency_code"`
	IsControlAccount bool    `json:"is_control_account"`
	ControlType      string  `json:"control_type"`
	NormalBalance    string  `json:"normal_balance"`
	OpeningBalance   float64 `json:"opening_balance"`
}

type UpdateAccountRequest struct {
	Name             *string  `json:"name"`
	Description      *string  `json:"description"`
	CurrencyCode     *string  `json:"currency_code"`
	IsActive         *bool    `json:"is_active"`
	IsControlAccount *bool    `json:"is_control_account"`
	ControlType      *string  `json:"control_type"`
	OpeningBalance   *float64 `json:"opening_balance"`
}

func (h *AccountHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var accounts []accModels.Account
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("code ILIKE ? OR name ILIKE ?", search, search)
	}

	accountType := c.Query("account_type")
	if accountType != "" {
		query = query.Where("account_type = ?", accountType)
	}

	parentID := c.Query("parent_id")
	if parentID == "null" || parentID == "root" {
		query = query.Where("parent_id IS NULL")
	} else if parentID != "" {
		query = query.Where("parent_id = ?", parentID)
	}

	isActive := c.Query("is_active")
	if isActive == "true" {
		query = query.Where("is_active = ?", true)
	} else if isActive == "false" {
		query = query.Where("is_active = ?", false)
	}

	query.Model(&accModels.Account{}).Count(&total)

	err := query.
		Order(params.SortBy + " " + params.SortOrder).
		Scopes(utils.Paginate(params)).
		Find(&accounts).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch accounts")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(accounts, total, params))
}

func (h *AccountHandler) Tree(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var accounts []accModels.Account
	err := h.db.Where("company_id = ? AND is_active = ?", companyID, true).
		Order("code ASC").
		Find(&accounts).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch accounts")
	}

	tree := buildAccountTree(accounts, nil)
	return utils.SuccessResponse(c, tree)
}

func buildAccountTree(accounts []accModels.Account, parentID *uuid.UUID) []accModels.Account {
	var tree []accModels.Account
	for _, acc := range accounts {
		if (parentID == nil && acc.ParentID == nil) || (parentID != nil && acc.ParentID != nil && *acc.ParentID == *parentID) {
			children := buildAccountTree(accounts, &acc.ID)
			acc.Children = children
			tree = append(tree, acc)
		}
	}
	return tree
}

func (h *AccountHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var account accModels.Account
	err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&account).Error
	if err != nil {
		return utils.NotFoundResponse(c, "Account not found")
	}

	return utils.SuccessResponse(c, account)
}

func (h *AccountHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreateAccountRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Code == "" || req.Name == "" || req.AccountType == "" {
		return utils.BadRequestResponse(c, "Code, name and account type are required")
	}

	var existing accModels.Account
	if err := h.db.Where("code = ? AND company_id = ?", req.Code, companyID).First(&existing).Error; err == nil {
		return utils.BadRequestResponse(c, "Account code already exists")
	}

	account := accModels.Account{
		CompanyID:        companyID,
		Code:             req.Code,
		Name:             req.Name,
		AccountType:      accModels.AccountType(req.AccountType),
		Description:      req.Description,
		CurrencyCode:     req.CurrencyCode,
		IsActive:         true,
		IsControlAccount: req.IsControlAccount,
		ControlType:      req.ControlType,
		NormalBalance:    req.NormalBalance,
		OpeningBalance:   req.OpeningBalance,
		CurrentBalance:   req.OpeningBalance,
	}

	if req.CurrencyCode == "" {
		account.CurrencyCode = "USD"
	}
	if req.NormalBalance == "" {
		switch account.AccountType {
		case accModels.AccountTypeAsset, accModels.AccountTypeExpense:
			account.NormalBalance = "debit"
		default:
			account.NormalBalance = "credit"
		}
	}

	if req.ParentID != nil && *req.ParentID != "" {
		parentUUID, err := uuid.Parse(*req.ParentID)
		if err == nil {
			account.ParentID = &parentUUID
			var parent accModels.Account
			if err := h.db.Where("id = ? AND company_id = ?", parentUUID, companyID).First(&parent).Error; err == nil {
				account.Level = parent.Level + 1
				account.FullPath = parent.FullPath + " > " + req.Name
			}
		}
	} else {
		account.Level = 0
		account.FullPath = req.Name
	}

	if err := h.db.Create(&account).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create account")
	}

	return utils.CreatedResponse(c, account)
}

func (h *AccountHandler) Update(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var account accModels.Account
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&account).Error; err != nil {
		return utils.NotFoundResponse(c, "Account not found")
	}

	var req UpdateAccountRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.CurrencyCode != nil {
		updates["currency_code"] = *req.CurrencyCode
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.IsControlAccount != nil {
		updates["is_control_account"] = *req.IsControlAccount
	}
	if req.ControlType != nil {
		updates["control_type"] = *req.ControlType
	}
	if req.OpeningBalance != nil {
		updates["opening_balance"] = *req.OpeningBalance
	}

	if err := h.db.Model(&account).Updates(updates).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update account")
	}

	h.db.First(&account, "id = ?", id)
	return utils.SuccessResponse(c, account, "Account updated successfully")
}

func (h *AccountHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var account accModels.Account
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&account).Error; err != nil {
		return utils.NotFoundResponse(c, "Account not found")
	}

	if account.IsSystem {
		return utils.BadRequestResponse(c, "Cannot delete system account")
	}

	var childCount int64
	h.db.Model(&accModels.Account{}).Where("parent_id = ?", id).Count(&childCount)
	if childCount > 0 {
		return utils.BadRequestResponse(c, "Cannot delete account with children")
	}

	var entryCount int64
	h.db.Model(&accModels.JournalEntry{}).Where("account_id = ?", id).Count(&entryCount)
	if entryCount > 0 {
		return utils.BadRequestResponse(c, "Cannot delete account with journal entries")
	}

	if err := h.db.Delete(&account).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete account")
	}

	return utils.SuccessResponse(c, nil, "Account deleted successfully")
}

func (h *AccountHandler) SeedDefaultAccounts(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var count int64
	h.db.Model(&accModels.Account{}).Where("company_id = ?", companyID).Count(&count)
	if count > 0 {
		return utils.BadRequestResponse(c, "Chart of accounts already has entries")
	}

	defaults := []accModels.Account{
		{CompanyID: companyID, Code: "1000", Name: "Assets", AccountType: accModels.AccountTypeAsset, IsSystem: true, NormalBalance: "debit", Level: 0, FullPath: "Assets"},
		{CompanyID: companyID, Code: "1100", Name: "Cash", AccountType: accModels.AccountTypeAsset, NormalBalance: "debit", Level: 1, FullPath: "Assets > Cash"},
		{CompanyID: companyID, Code: "1200", Name: "Bank", AccountType: accModels.AccountTypeAsset, NormalBalance: "debit", Level: 1, FullPath: "Assets > Bank"},
		{CompanyID: companyID, Code: "1300", Name: "Accounts Receivable", AccountType: accModels.AccountTypeAsset, IsControlAccount: true, ControlType: "receivable", NormalBalance: "debit", Level: 1, FullPath: "Assets > Accounts Receivable"},
		{CompanyID: companyID, Code: "1400", Name: "Inventory", AccountType: accModels.AccountTypeAsset, IsControlAccount: true, ControlType: "inventory", NormalBalance: "debit", Level: 1, FullPath: "Assets > Inventory"},
		{CompanyID: companyID, Code: "2000", Name: "Liabilities", AccountType: accModels.AccountTypeLiability, IsSystem: true, NormalBalance: "credit", Level: 0, FullPath: "Liabilities"},
		{CompanyID: companyID, Code: "2100", Name: "Accounts Payable", AccountType: accModels.AccountTypeLiability, IsControlAccount: true, ControlType: "payable", NormalBalance: "credit", Level: 1, FullPath: "Liabilities > Accounts Payable"},
		{CompanyID: companyID, Code: "2200", Name: "Taxes Payable", AccountType: accModels.AccountTypeLiability, NormalBalance: "credit", Level: 1, FullPath: "Liabilities > Taxes Payable"},
		{CompanyID: companyID, Code: "3000", Name: "Equity", AccountType: accModels.AccountTypeEquity, IsSystem: true, NormalBalance: "credit", Level: 0, FullPath: "Equity"},
		{CompanyID: companyID, Code: "3100", Name: "Owner Capital", AccountType: accModels.AccountTypeEquity, NormalBalance: "credit", Level: 1, FullPath: "Equity > Owner Capital"},
		{CompanyID: companyID, Code: "3200", Name: "Retained Earnings", AccountType: accModels.AccountTypeEquity, NormalBalance: "credit", Level: 1, FullPath: "Equity > Retained Earnings"},
		{CompanyID: companyID, Code: "4000", Name: "Revenue", AccountType: accModels.AccountTypeRevenue, IsSystem: true, NormalBalance: "credit", Level: 0, FullPath: "Revenue"},
		{CompanyID: companyID, Code: "4100", Name: "Product Sales", AccountType: accModels.AccountTypeRevenue, NormalBalance: "credit", Level: 1, FullPath: "Revenue > Product Sales"},
		{CompanyID: companyID, Code: "4200", Name: "Shipping Income", AccountType: accModels.AccountTypeRevenue, NormalBalance: "credit", Level: 1, FullPath: "Revenue > Shipping Income"},
		{CompanyID: companyID, Code: "5000", Name: "Cost of Goods Sold", AccountType: accModels.AccountTypeExpense, IsSystem: true, NormalBalance: "debit", Level: 0, FullPath: "Cost of Goods Sold"},
		{CompanyID: companyID, Code: "6000", Name: "Expenses", AccountType: accModels.AccountTypeExpense, IsSystem: true, NormalBalance: "debit", Level: 0, FullPath: "Expenses"},
		{CompanyID: companyID, Code: "6100", Name: "Marketing", AccountType: accModels.AccountTypeExpense, NormalBalance: "debit", Level: 1, FullPath: "Expenses > Marketing"},
		{CompanyID: companyID, Code: "6200", Name: "Salaries", AccountType: accModels.AccountTypeExpense, NormalBalance: "debit", Level: 1, FullPath: "Expenses > Salaries"},
		{CompanyID: companyID, Code: "6300", Name: "Hosting", AccountType: accModels.AccountTypeExpense, NormalBalance: "debit", Level: 1, FullPath: "Expenses > Hosting"},
	}

	// Set parent IDs
	tx := h.db.Begin()
	parentMap := map[string]uuid.UUID{}

	for i := range defaults {
		defaults[i].IsActive = true
		defaults[i].CurrencyCode = "USD"
		if err := tx.Create(&defaults[i]).Error; err != nil {
			tx.Rollback()
			return utils.InternalErrorResponse(c, "Failed to seed accounts: "+err.Error())
		}
		parentMap[defaults[i].Code] = defaults[i].ID
	}

	// Update parent references
	parentLinks := map[string]string{
		"1100": "1000", "1200": "1000", "1300": "1000", "1400": "1000",
		"2100": "2000", "2200": "2000",
		"3100": "3000", "3200": "3000",
		"4100": "4000", "4200": "4000",
		"6100": "6000", "6200": "6000", "6300": "6000",
	}

	for childCode, parentCode := range parentLinks {
		if childID, ok := parentMap[childCode]; ok {
			if parentID, ok := parentMap[parentCode]; ok {
				tx.Model(&accModels.Account{}).Where("id = ?", childID).Update("parent_id", parentID)
			}
		}
	}

	tx.Commit()
	return utils.SuccessResponse(c, nil, "Default chart of accounts created")
}

func (h *AccountHandler) RegisterRoutes(api fiber.Router) {
	accounts := api.Group("/accounting/accounts")
	accounts.Get("/", h.List)
	accounts.Get("/tree", h.Tree)
	accounts.Post("/seed", h.SeedDefaultAccounts)
	accounts.Get("/:id", h.Get)
	accounts.Post("/", h.Create)
	accounts.Put("/:id", h.Update)
	accounts.Delete("/:id", h.Delete)
}
