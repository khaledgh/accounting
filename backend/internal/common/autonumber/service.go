package autonumber

import (
	"fmt"
	"strings"
	"sync"

	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Service struct {
	db *gorm.DB
	mu sync.Mutex
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Service) GenerateNumber(companyID uuid.UUID, branchID *uuid.UUID, entityType string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var seq models.AutoNumberSequence

	query := s.db.Where("company_id = ? AND entity_type = ?", companyID, entityType)
	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	} else {
		query = query.Where("branch_id IS NULL")
	}

	err := query.Clauses(clause.Locking{Strength: "UPDATE"}).First(&seq).Error
	if err != nil {
		return "", fmt.Errorf("auto number sequence not found for %s: %w", entityType, err)
	}

	number := fmt.Sprintf("%s%s%s",
		seq.Prefix,
		padNumber(seq.NextNumber, seq.Padding),
		seq.Suffix,
	)

	seq.NextNumber++
	if err := s.db.Save(&seq).Error; err != nil {
		return "", fmt.Errorf("failed to update sequence: %w", err)
	}

	return number, nil
}

func (s *Service) EnsureSequence(companyID uuid.UUID, branchID *uuid.UUID, entityType, prefix string, padding int) error {
	var count int64
	query := s.db.Model(&models.AutoNumberSequence{}).
		Where("company_id = ? AND entity_type = ?", companyID, entityType)
	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	} else {
		query = query.Where("branch_id IS NULL")
	}
	query.Count(&count)

	if count == 0 {
		seq := models.AutoNumberSequence{
			CompanyID:  companyID,
			BranchID:   branchID,
			EntityType: entityType,
			Prefix:     prefix,
			NextNumber: 1,
			Padding:    padding,
			IsActive:   true,
		}
		return s.db.Create(&seq).Error
	}
	return nil
}

func padNumber(n int64, padding int) string {
	format := fmt.Sprintf("%%0%dd", padding)
	return strings.TrimSpace(fmt.Sprintf(format, n))
}
