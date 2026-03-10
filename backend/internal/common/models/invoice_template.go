package models

import "github.com/google/uuid"

type InvoiceTemplate struct {
	BaseModel
	CompanyID        uuid.UUID `json:"company_id" gorm:"type:uuid;not null;index"`
	Name             string    `json:"name" gorm:"size:100;not null"`
	LogoURL          string    `json:"logo_url" gorm:"size:500"`
	HeaderText       string    `json:"header_text" gorm:"size:1000"`
	FooterText       string    `json:"footer_text" gorm:"size:1000"`
	PaymentTerms     string    `json:"payment_terms" gorm:"size:500"`
	NotesTemplate    string    `json:"notes_template" gorm:"size:1000"`
	ShowTaxBreakdown bool      `json:"show_tax_breakdown" gorm:"default:true"`
	CurrencyFormat   string    `json:"currency_format" gorm:"size:10;default:'$'"`
	IsDefault        bool      `json:"is_default" gorm:"default:false"`
}

func (InvoiceTemplate) TableName() string {
	return "invoice_templates"
}
