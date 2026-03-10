package models

import "github.com/google/uuid"

type Company struct {
	BaseModel
	Name        string   `json:"name" gorm:"not null"`
	Code        string   `json:"code" gorm:"uniqueIndex;not null;size:20"`
	TaxID       string   `json:"tax_id" gorm:"size:50"`
	Email       string   `json:"email" gorm:"size:255"`
	Phone       string   `json:"phone" gorm:"size:50"`
	Address     string   `json:"address"`
	City        string   `json:"city" gorm:"size:100"`
	Country     string   `json:"country" gorm:"size:100"`
	PostalCode  string   `json:"postal_code" gorm:"size:20"`
	Website     string   `json:"website" gorm:"size:255"`
	Logo        string   `json:"logo" gorm:"size:500"`
	CurrencyID  *uuid.UUID `json:"currency_id" gorm:"type:uuid"`
	IsActive    bool     `json:"is_active" gorm:"default:true"`
	Branches    []Branch `json:"branches,omitempty" gorm:"foreignKey:CompanyID"`
}

func (Company) TableName() string {
	return "companies"
}

type Branch struct {
	BaseModel
	CompanyID uuid.UUID `json:"company_id" gorm:"type:uuid;not null;index"`
	Company   *Company  `json:"company,omitempty" gorm:"foreignKey:CompanyID"`
	Name      string    `json:"name" gorm:"not null"`
	Code      string    `json:"code" gorm:"not null;size:20"`
	Email     string    `json:"email" gorm:"size:255"`
	Phone     string    `json:"phone" gorm:"size:50"`
	Address   string    `json:"address"`
	City      string    `json:"city" gorm:"size:100"`
	Country   string    `json:"country" gorm:"size:100"`
	IsActive  bool      `json:"is_active" gorm:"default:true"`
	IsMain    bool      `json:"is_main" gorm:"default:false"`
}

func (Branch) TableName() string {
	return "branches"
}
