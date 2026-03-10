package models

import (
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
)

type EventType string

const (
	EventOrderCreated   EventType = "order.created"
	EventOrderConfirmed EventType = "order.confirmed"
	EventOrderShipped   EventType = "order.shipped"
	EventOrderDelivered EventType = "order.delivered"
	EventOrderCancelled EventType = "order.cancelled"
	EventPaymentReceived EventType = "payment.received"
	EventPaymentRefunded EventType = "payment.refunded"
	EventInvoiceIssued   EventType = "invoice.issued"
)

type AccountMapping struct {
	models.BaseModel
	CompanyID        uuid.UUID `json:"company_id" gorm:"type:uuid;not null;index"`
	EventType        EventType `json:"event_type" gorm:"not null;size:50;uniqueIndex:idx_mapping_event"`
	DebitAccountID   uuid.UUID `json:"debit_account_id" gorm:"type:uuid;not null"`
	CreditAccountID  uuid.UUID `json:"credit_account_id" gorm:"type:uuid;not null"`
	Description      string    `json:"description" gorm:"size:500"`
	IsActive         bool      `json:"is_active" gorm:"default:true"`
}

func (AccountMapping) TableName() string {
	return "account_mappings"
}

type IntegrationLog struct {
	models.BaseModel
	CompanyID   uuid.UUID `json:"company_id" gorm:"type:uuid;not null;index"`
	EventType   EventType `json:"event_type" gorm:"not null;size:50;index"`
	SourceID    uuid.UUID `json:"source_id" gorm:"type:uuid;not null;index"`
	SourceType  string    `json:"source_type" gorm:"not null;size:50"`
	JournalID   *uuid.UUID `json:"journal_id" gorm:"type:uuid"`
	Status      string    `json:"status" gorm:"not null;size:20;default:'pending'"`
	ErrorMsg    string    `json:"error_msg"`
	Payload     string    `json:"payload" gorm:"type:text"`
}

func (IntegrationLog) TableName() string {
	return "integration_logs"
}
