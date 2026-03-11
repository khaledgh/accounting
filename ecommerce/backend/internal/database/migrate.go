package database

import (
	"log"

	"github.com/gonext/ecommerce/internal/models"
	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) {
	err := db.AutoMigrate(
		&models.StoreCustomer{},
		&models.StoreAddress{},
		&models.StoreCart{},
		&models.StoreCartItem{},
		&models.StoreWishlist{},
		&models.StoreReview{},
		&models.StoreFavorite{},
		&models.WebsiteSetting{},
	)
	if err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	log.Println("✓ Migrations completed")
}
