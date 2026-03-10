package models

import (
	"time"

	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
)

type JournalStatus string

const (
	JournalStatusDraft    JournalStatus = "draft"
	JournalStatusPosted   JournalStatus = "posted"
	JournalStatusReversed JournalStatus = "reversed"
)

type Journal struct {
	models.BaseModel
	CompanyID       uuid.UUID      `json:"company_id" gorm:"type:uuid;not null;index"`
	BranchID        *uuid.UUID     `json:"branch_id" gorm:"type:uuid;index"`
	FinancialYearID uuid.UUID      `json:"financial_year_id" gorm:"type:uuid;not null;index"`
	FiscalPeriodID  *uuid.UUID     `json:"fiscal_period_id" gorm:"type:uuid;index"`
	Number          string         `json:"number" gorm:"not null;size:50;uniqueIndex:idx_journal_number"`
	Date            time.Time      `json:"date" gorm:"not null;index"`
	Reference       string         `json:"reference" gorm:"size:100"`
	Description     string         `json:"description"`
	Status          JournalStatus  `json:"status" gorm:"not null;size:20;default:'draft';index"`
	TotalDebit      float64        `json:"total_debit" gorm:"type:decimal(18,4);default:0"`
	TotalCredit     float64        `json:"total_credit" gorm:"type:decimal(18,4);default:0"`
	CurrencyCode    string         `json:"currency_code" gorm:"size:3;default:'USD'"`
	ExchangeRate    float64        `json:"exchange_rate" gorm:"type:decimal(18,8);default:1"`
	ReversedByID    *uuid.UUID     `json:"reversed_by_id" gorm:"type:uuid"`
	ReversalOfID    *uuid.UUID     `json:"reversal_of_id" gorm:"type:uuid"`
	Source          string         `json:"source" gorm:"size:50"`
	SourceID        *uuid.UUID     `json:"source_id" gorm:"type:uuid"`
	CreatedByID     *uuid.UUID     `json:"created_by_id" gorm:"type:uuid"`
	PostedByID      *uuid.UUID     `json:"posted_by_id" gorm:"type:uuid"`
	PostedAt        *time.Time     `json:"posted_at"`
	Entries         []JournalEntry `json:"entries,omitempty" gorm:"foreignKey:JournalID"`
}

func (Journal) TableName() string {
	return "journals"
}

type JournalEntry struct {
	models.BaseModel
	JournalID    uuid.UUID  `json:"journal_id" gorm:"type:uuid;not null;index"`
	Journal      *Journal   `json:"journal,omitempty" gorm:"foreignKey:JournalID"`
	AccountID    uuid.UUID  `json:"account_id" gorm:"type:uuid;not null;index"`
	Account      *Account   `json:"account,omitempty" gorm:"foreignKey:AccountID"`
	Description  string     `json:"description" gorm:"size:500"`
	DebitAmount  float64    `json:"debit_amount" gorm:"type:decimal(18,4);default:0"`
	CreditAmount float64   `json:"credit_amount" gorm:"type:decimal(18,4);default:0"`
	CurrencyCode string    `json:"currency_code" gorm:"size:3;default:'USD'"`
	ExchangeRate float64   `json:"exchange_rate" gorm:"type:decimal(18,8);default:1"`
	BaseDebit    float64   `json:"base_debit" gorm:"type:decimal(18,4);default:0"`
	BaseCredit   float64   `json:"base_credit" gorm:"type:decimal(18,4);default:0"`
	CostCenterID *uuid.UUID `json:"cost_center_id" gorm:"type:uuid"`
	LineNumber   int        `json:"line_number" gorm:"not null"`
}

func (JournalEntry) TableName() string {
	return "journal_entries"
}

type CostCenter struct {
	models.BaseModel
	CompanyID   uuid.UUID  `json:"company_id" gorm:"type:uuid;not null;index"`
	ParentID    *uuid.UUID `json:"parent_id" gorm:"type:uuid"`
	Code        string     `json:"code" gorm:"not null;size:20"`
	Name        string     `json:"name" gorm:"not null;size:200"`
	Description string     `json:"description"`
	IsActive    bool       `json:"is_active" gorm:"default:true"`
}

func (CostCenter) TableName() string {
	return "cost_centers"
}
