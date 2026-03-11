package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gonext/ecommerce/internal/config"
	"github.com/google/uuid"
)

type Claims struct {
	CustomerID uuid.UUID `json:"customer_id"`
	Email      string    `json:"email"`
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
}

func GenerateTokens(cfg *config.JWTConfig, customerID uuid.UUID, email string) (*TokenPair, error) {
	now := time.Now()
	accessExp := now.Add(cfg.Expiry)

	accessClaims := Claims{
		CustomerID: customerID,
		Email:      email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExp),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   customerID.String(),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessStr, err := accessToken.SignedString([]byte(cfg.Secret))
	if err != nil {
		return nil, err
	}

	refreshExp := now.Add(cfg.RefreshExpiry)
	refreshClaims := Claims{
		CustomerID: customerID,
		Email:      email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExp),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   customerID.String(),
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshStr, err := refreshToken.SignedString([]byte(cfg.Secret))
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessStr,
		RefreshToken: refreshStr,
		ExpiresAt:    accessExp.Unix(),
	}, nil
}

func ValidateToken(cfg *config.JWTConfig, tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(cfg.Secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}
	return claims, nil
}
