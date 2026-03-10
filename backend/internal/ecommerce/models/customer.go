package models

import (
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
)

type Customer struct {
	models.BaseModel
	CompanyID    uuid.UUID `json:"company_id" gorm:"type:uuid;not null;index"`
	BranchID     *uuid.UUID `json:"branch_id" gorm:"type:uuid;index"`
	Code         string    `json:"code" gorm:"not null;size:50;uniqueIndex:idx_customer_code"`
	FirstName    string    `json:"first_name" gorm:"not null;size:100"`
	LastName     string    `json:"last_name" gorm:"not null;size:100"`
	CompanyName  string    `json:"company_name" gorm:"size:200"`
	Email        string    `json:"email" gorm:"size:200;index"`
	Phone        string    `json:"phone" gorm:"size:50"`
	TaxID        string    `json:"tax_id" gorm:"size:50"`
	Address      string    `json:"address"`
	City         string    `json:"city" gorm:"size:100"`
	State        string    `json:"state" gorm:"size:100"`
	PostalCode   string    `json:"postal_code" gorm:"size:20"`
	Country      string    `json:"country" gorm:"size:100"`
	Notes        string    `json:"notes"`
	CreditLimit  float64   `json:"credit_limit" gorm:"type:decimal(18,4);default:0"`
	Balance      float64   `json:"balance" gorm:"type:decimal(18,4);default:0"`
	IsActive     bool      `json:"is_active" gorm:"default:true"`
}

func (Customer) TableName() string {
	return "customers"
}

type Supplier struct {
	models.BaseModel
	CompanyID    uuid.UUID  `json:"company_id" gorm:"type:uuid;not null;index"`
	BranchID     *uuid.UUID `json:"branch_id" gorm:"type:uuid;index"`
	Code         string     `json:"code" gorm:"not null;size:50;uniqueIndex:idx_supplier_code"`
	Name         string     `json:"name" gorm:"not null;size:200"`
	ContactName  string     `json:"contact_name" gorm:"size:200"`
	Email        string     `json:"email" gorm:"size:200;index"`
	Phone        string     `json:"phone" gorm:"size:50"`
	TaxID        string     `json:"tax_id" gorm:"size:50"`
	Address      string     `json:"address"`
	City         string     `json:"city" gorm:"size:100"`
	State        string     `json:"state" gorm:"size:100"`
	PostalCode   string     `json:"postal_code" gorm:"size:20"`
	Country      string     `json:"country" gorm:"size:100"`
	Website      string     `json:"website" gorm:"size:300"`
	Notes        string     `json:"notes"`
	PaymentTerms string     `json:"payment_terms" gorm:"size:50"`
	Balance      float64    `json:"balance" gorm:"type:decimal(18,4);default:0"`
	IsActive     bool       `json:"is_active" gorm:"default:true"`
}

func (Supplier) TableName() string {
	return "suppliers"
}
