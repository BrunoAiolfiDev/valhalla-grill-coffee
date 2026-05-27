# Valhalla Grill & Coffee

Sistema web de pedidos online com:

- Cardapio dinâmico
- Carrinho e criação de pedido
- Checkout Stripe
- Painel de cozinha em tempo real
- Banco de dados Firebase Firestore

## Stack

- Next.js 16 (App Router)
- TypeScript
- Firebase (Firestore)
- Stripe
- Tailwind CSS 4

## Rotas

- `/` Cliente: cardapio, carrinho e checkout
- `/sucesso` Confirma pagamento e envia para cozinha
- `/cozinha` Painel de produção dos pedidos
- `/api/checkout` Cria sessão de checkout no Stripe

## 1. Configuração de ambiente

Copie `.env.example` para `.env.local` e preencha os valores:

```bash
cp .env.example .env.local
```

## 2. Rodar local

```bash
npm install
npm run dev
```

App em `http://localhost:3000`

## 3. Regras Firestore (desenvolvimento)

Durante desenvolvimento, publique as regras de `firestore.rules` no Firebase Console.

Importante: as regras atuais são permissivas para facilitar setup local. Antes de ir para produção, endureça as regras com autenticação e roles.

## 4. Estrutura esperada no Firestore

### Coleção `cardapio`

Documento exemplo:

```json
{
  "name": "Valhalla Classic Burger",
  "description": "Pao brioche, burger 180g, cheddar e molho da casa.",
  "category": "burgers",
  "priceCents": 1190,
  "active": true
}
```

### Coleção `pedidos`

Campos usados pela aplicação:

- `customerName`
- `items[]`
- `totalCents`
- `paymentStatus` (`pending` | `paid`)
- `kitchenStatus` (`aguardando_pagamento` | `pago` | `em_preparo` | `pronto` | `entregue`)
- `createdAt`

## 5. Fluxo atual de pagamento

1. Cliente cria pedido em `/`
2. Sistema abre Stripe Checkout
3. Em `/sucesso`, pedido é marcado como pago
4. Pedido aparece no painel `/cozinha`

## Observação de produção

Para produção, mova a confirmação de pagamento para webhook Stripe server-side para evitar confirmação apenas por redirecionamento de URL.
