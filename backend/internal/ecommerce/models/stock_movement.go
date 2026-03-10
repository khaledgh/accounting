package models

import (
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
)

type StockMovement struct {
	models.BaseModel
	CompanyID     uuid.UUID `json:"company_id" gorm:"type:uuid;not null;index"`
	ProductID     uuid.UUID `json:"product_id" gorm:"type:uuid;not null;index"`
	Product       *Product  `json:"product,omitempty" gorm:"foreignKey:ProductID"`
	Quantity      int       `json:"quantity" gorm:"not null"`
	Type          string    `json:"type" gorm:"size:20;not null"`
	ReferenceType string    `json:"reference_type" gorm:"size:30"`
	ReferenceID   string    `json:"reference_id" gorm:"size:50"`
	Notes         string    `json:"notes"`
	CreatedByID   *uuid.UUID `json:"created_by_id" gorm:"type:uuid"`
}

func (StockMovement) TableName() string {
	return "stock_movements"
}

const (
	StockMovementTypeSale       = "sale"
	StockMovementTypePurchase   = "purchase"
	StockMovementTypeAdjustment = "adjustment"
	StockMovementTypeReturn     = "return"
	StockMovementTypeCancel     = "cancel"
)
