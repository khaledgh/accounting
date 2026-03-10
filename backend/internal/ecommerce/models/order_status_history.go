package models

import (
	"time"

	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
)

type OrderStatusHistory struct {
	models.BaseModel
	OrderID   uuid.UUID  `json:"order_id" gorm:"type:uuid;not null;index"`
	Status    string     `json:"status" gorm:"size:30;not null"`
	Notes     string     `json:"notes" gorm:"size:500"`
	ChangedBy *uuid.UUID `json:"changed_by" gorm:"type:uuid"`
	ChangedAt time.Time  `json:"changed_at" gorm:"not null"`
}

func (OrderStatusHistory) TableName() string {
	return "order_status_history"
}
