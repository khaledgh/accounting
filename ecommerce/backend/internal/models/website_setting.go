package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WebsiteSetting struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	Key       string         `json:"key" gorm:"uniqueIndex;not null;size:100"`
	Value     string         `json:"value" gorm:"type:text"`
	IsActive  bool           `json:"is_active" gorm:"default:true"`
	Metadata  string         `json:"metadata" gorm:"type:text"`
}

func (WebsiteSetting) TableName() string {
	return "website_settings"
}

func (b *WebsiteSetting) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

// CarouselSlide represents a single slide in the hero carousel
type CarouselSlide struct {
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle"`
	ImageURL    string `json:"image_url"`
	ButtonText  string `json:"button_text"`
	ButtonLink  string `json:"button_link"`
	Gradient    string `json:"gradient"`
	IsActive    bool   `json:"is_active"`
	SortOrder   int    `json:"sort_order"`
}
