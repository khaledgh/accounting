package models

import (
	"time"

	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
)

type PurchaseInvoiceStatus string

const (
	PurchaseInvoiceStatusDraft     PurchaseInvoiceStatus = "draft"
	PurchaseInvoiceStatusConfirmed PurchaseInvoiceStatus = "confirmed"
	PurchaseInvoiceStatusPaid      PurchaseInvoiceStatus = "paid"
	PurchaseInvoiceStatusCancelled PurchaseInvoiceStatus = "cancelled"
)

type PurchaseInvoice struct {
	models.BaseModel
	CompanyID     uuid.UUID             `json:"company_id" gorm:"type:uuid;not null;index"`
	SupplierID    *uuid.UUID            `json:"supplier_id" gorm:"type:uuid;index"`
	InvoiceNumber string                `json:"invoice_number" gorm:"not null;size:50;uniqueIndex:idx_purchase_invoice_number"`
	InvoiceDate   time.Time             `json:"invoice_date" gorm:"not null"`
	DueDate       time.Time             `json:"due_date" gorm:"not null"`
	Status        PurchaseInvoiceStatus `json:"status" gorm:"size:20;default:'draft'"`
	Subtotal      float64               `json:"subtotal" gorm:"type:decimal(18,4);default:0"`
	TaxAmount     float64               `json:"tax_amount" gorm:"type:decimal(18,4);default:0"`
	TotalAmount   float64               `json:"total_amount" gorm:"type:decimal(18,4);default:0"`
	PaidAmount    float64               `json:"paid_amount" gorm:"type:decimal(18,4);default:0"`
	CurrencyCode  string                `json:"currency_code" gorm:"size:3;default:'USD'"`
	Notes         string                `json:"notes"`
	Items         []PurchaseInvoiceItem `json:"items,omitempty" gorm:"foreignKey:PurchaseInvoiceID"`
}

func (PurchaseInvoice) TableName() string {
	return "purchase_invoices"
}

type PurchaseInvoiceItem struct {
	models.BaseModel
	PurchaseInvoiceID uuid.UUID  `json:"purchase_invoice_id" gorm:"type:uuid;not null;index"`
	ProductID         *uuid.UUID `json:"product_id" gorm:"type:uuid"`
	VariantID         *uuid.UUID `json:"variant_id" gorm:"type:uuid"`
	Description       string     `json:"description" gorm:"not null;size:500"`
	Quantity          int        `json:"quantity" gorm:"not null;default:1"`
	UnitPrice         float64    `json:"unit_price" gorm:"type:decimal(18,4);not null"`
	TaxRate           float64    `json:"tax_rate" gorm:"type:decimal(5,2);default:0"`
	TaxAmount         float64    `json:"tax_amount" gorm:"type:decimal(18,4);default:0"`
	TotalAmount       float64    `json:"total_amount" gorm:"type:decimal(18,4);not null"`
	LineNumber        int        `json:"line_number" gorm:"not null"`
}

func (PurchaseInvoiceItem) TableName() string {
	return "purchase_invoice_items"
}
