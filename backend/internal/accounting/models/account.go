package models

import (
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
)

type AccountType string

const (
	AccountTypeAsset     AccountType = "asset"
	AccountTypeLiability AccountType = "liability"
	AccountTypeEquity    AccountType = "equity"
	AccountTypeRevenue   AccountType = "revenue"
	AccountTypeExpense   AccountType = "expense"
)

type Account struct {
	models.BaseModel
	CompanyID      uuid.UUID   `json:"company_id" gorm:"type:uuid;not null;index"`
	ParentID       *uuid.UUID  `json:"parent_id" gorm:"type:uuid;index"`
	Parent         *Account    `json:"parent,omitempty" gorm:"foreignKey:ParentID"`
	Children       []Account   `json:"children,omitempty" gorm:"foreignKey:ParentID"`
	Code           string      `json:"code" gorm:"not null;size:20;uniqueIndex:idx_account_code"`
	Name           string      `json:"name" gorm:"not null;size:200"`
	AccountType    AccountType `json:"account_type" gorm:"not null;size:20;index"`
	Description    string      `json:"description"`
	CurrencyCode   string      `json:"currency_code" gorm:"size:3;default:'USD'"`
	IsActive       bool        `json:"is_active" gorm:"default:true"`
	IsSystem       bool        `json:"is_system" gorm:"default:false"`
	IsControlAccount bool      `json:"is_control_account" gorm:"default:false"`
	ControlType    string      `json:"control_type" gorm:"size:20"`
	Level          int         `json:"level" gorm:"default:0"`
	FullPath       string      `json:"full_path" gorm:"size:500"`
	NormalBalance  string      `json:"normal_balance" gorm:"size:10;default:'debit'"`
	OpeningBalance float64     `json:"opening_balance" gorm:"type:decimal(18,4);default:0"`
	CurrentBalance float64     `json:"current_balance" gorm:"type:decimal(18,4);default:0"`
}

func (Account) TableName() string {
	return "accounts"
}

type Currency struct {
	models.BaseModel
	Code         string  `json:"code" gorm:"uniqueIndex;not null;size:3"`
	Name         string  `json:"name" gorm:"not null;size:100"`
	Symbol       string  `json:"symbol" gorm:"not null;size:10"`
	DecimalPlaces int    `json:"decimal_places" gorm:"default:2"`
	IsActive     bool    `json:"is_active" gorm:"default:true"`
	IsDefault    bool    `json:"is_default" gorm:"default:false"`
}

func (Currency) TableName() string {
	return "currencies"
}

type ExchangeRate struct {
	models.BaseModel
	CompanyID      uuid.UUID `json:"company_id" gorm:"type:uuid;not null;index"`
	FromCurrency   string    `json:"from_currency" gorm:"not null;size:3"`
	ToCurrency     string    `json:"to_currency" gorm:"not null;size:3"`
	Rate           float64   `json:"rate" gorm:"type:decimal(18,8);not null"`
	EffectiveDate  string    `json:"effective_date" gorm:"not null;size:10"`
}

func (ExchangeRate) TableName() string {
	return "exchange_rates"
}
