# API Overview

Base URL: `/api`

- POST `/auth/login`
- GET `/dashboard`
- GET `/assets?q=`
- GET `/assets/:id`
- POST `/assets`
- POST `/assets/:id/move`
- GET `/vendors`
- POST `/vendors`
- GET `/locations`
- POST `/locations`
- GET `/procurement/purchase-orders`
- POST `/procurement/purchase-orders`
- GET `/procurement/grns`

All endpoints except login require `Authorization: Bearer <token>`.
