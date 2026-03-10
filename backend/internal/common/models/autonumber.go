package models

import "github.com/google/uuid"

type AutoNumberSequence struct {
	BaseModel
	CompanyID  uuid.UUID  `json:"company_id" gorm:"type:uuid;not null;uniqueIndex:idx_auto_seq"`
	Company    *Company   `json:"company,omitempty" gorm:"foreignKey:CompanyID"`
	BranchID   *uuid.UUID `json:"branch_id" gorm:"type:uuid;uniqueIndex:idx_auto_seq"`
	Branch     *Branch    `json:"branch,omitempty" gorm:"foreignKey:BranchID"`
	EntityType string     `json:"entity_type" gorm:"not null;size:50;uniqueIndex:idx_auto_seq"`
	Prefix     string     `json:"prefix" gorm:"not null;size:20"`
	NextNumber int64      `json:"next_number" gorm:"not null;default:1"`
	Padding    int        `json:"padding" gorm:"not null;default:6"`
	Suffix     string     `json:"suffix" gorm:"size:20"`
	IsActive   bool       `json:"is_active" gorm:"default:true"`
}

func (AutoNumberSequence) TableName() string {
	return "auto_number_sequences"
}

type Setting struct {
	BaseModel
	CompanyID uuid.UUID `json:"company_id" gorm:"type:uuid;not null;index"`
	Company   *Company  `json:"company,omitempty" gorm:"foreignKey:CompanyID"`
	Key       string    `json:"key" gorm:"not null;size:200;uniqueIndex:idx_setting_key"`
	Value     string    `json:"value" gorm:"type:text"`
	Group     string    `json:"group" gorm:"size:100;index"`
}

func (Setting) TableName() string {
	return "settings"
}
