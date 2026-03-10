package models

import (
	"time"

	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
)

type PaymentType string

const (
	PaymentTypeReceive PaymentType = "receive"
	PaymentTypeMake    PaymentType = "make"
)

type AccountingPayment struct {
	models.BaseModel
	CompanyID     uuid.UUID   `json:"company_id" gorm:"type:uuid;not null;index"`
	BankAccountID uuid.UUID   `json:"bank_account_id" gorm:"type:uuid;not null;index"`
	BankAccount   *Account    `json:"bank_account,omitempty" gorm:"foreignKey:BankAccountID"`
	ContactType   string      `json:"contact_type" gorm:"size:20;not null"` // customer or supplier
	ContactID     *uuid.UUID  `json:"contact_id" gorm:"type:uuid"`
	PaymentType   PaymentType `json:"payment_type" gorm:"size:20;not null"`
	Amount        float64     `json:"amount" gorm:"type:decimal(18,4);not null"`
	CurrencyCode  string      `json:"currency_code" gorm:"size:3;default:'USD'"`
	PaymentDate   time.Time   `json:"payment_date" gorm:"not null"`
	Reference     string      `json:"reference" gorm:"size:100"`
	Method        string      `json:"method" gorm:"size:30;default:'bank_transfer'"`
	JournalID     *uuid.UUID  `json:"journal_id" gorm:"type:uuid"`
	Notes         string      `json:"notes"`
	Status        string      `json:"status" gorm:"size:20;default:'completed'"`
	ContactName   string      `json:"contact_name" gorm:"-"` // virtual field
}

func (AccountingPayment) TableName() string {
	return "accounting_payments"
}
