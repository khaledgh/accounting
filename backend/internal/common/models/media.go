package models

import (
	"github.com/google/uuid"
)

type Media struct {
	BaseModel
	CompanyID    uuid.UUID  `json:"company_id" gorm:"type:uuid;not null;index"`
	CreatedByID  *uuid.UUID `json:"created_by_id" gorm:"type:uuid;index"`
	Filename     string     `json:"filename" gorm:"not null;size:500"`
	OriginalName string     `json:"original_name" gorm:"not null;size:500"`
	MimeType     string     `json:"mime_type" gorm:"not null;size:100"`
	Size         int64      `json:"size" gorm:"not null"`
	URL          string     `json:"url" gorm:"not null;size:1000"`
	Alt          string     `json:"alt" gorm:"size:300"`
}

func (Media) TableName() string {
	return "media"
}
