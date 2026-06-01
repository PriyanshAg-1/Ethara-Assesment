from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.models import Customer, Order, OrderItem, Product
from app.schemas import OrderCreate, OrderRead


router = APIRouter(prefix="/orders", tags=["orders"])


def get_order_query():
    return select(Order).options(
        joinedload(Order.customer),
        selectinload(Order.items).joinedload(OrderItem.product),
    )


def get_order_or_404(order_id: int, db: Session) -> Order:
    order = db.scalar(get_order_query().where(Order.id == order_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)) -> Order:
    customer = db.get(Customer, payload.customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    requested_quantities: dict[int, int] = defaultdict(int)
    for item in payload.items:
        requested_quantities[item.product_id] += item.quantity

    product_ids = list(requested_quantities.keys())
    products = list(
        db.scalars(select(Product).where(Product.id.in_(product_ids)).with_for_update()).all()
    )
    product_map = {product.id: product for product in products}
    missing_ids = sorted(set(product_ids) - set(product_map.keys()))
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Products not found: {', '.join(str(product_id) for product_id in missing_ids)}",
        )

    insufficient_items = [
        product
        for product_id, quantity in requested_quantities.items()
        if (product := product_map[product_id]).quantity_in_stock < quantity
    ]
    if insufficient_items:
        detail = ", ".join(
            f"{product.sku} has {product.quantity_in_stock} available" for product in insufficient_items
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Insufficient inventory: {detail}")

    total_amount = Decimal("0.00")
    order = Order(customer_id=payload.customer_id, total_amount=total_amount)
    db.add(order)
    db.flush()

    for product_id, quantity in requested_quantities.items():
        product = product_map[product_id]
        line_total = product.price * quantity
        total_amount += line_total
        product.quantity_in_stock -= quantity
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=quantity,
                unit_price=product.price,
                line_total=line_total,
            )
        )

    order.total_amount = total_amount
    order_id = order.id
    db.commit()
    return get_order_or_404(order_id, db)


@router.get("", response_model=list[OrderRead])
def list_orders(db: Session = Depends(get_db)) -> list[Order]:
    return list(db.scalars(get_order_query().order_by(Order.created_at.desc())).all())


@router.get("/{order_id}", response_model=OrderRead)
def get_order(order_id: int, db: Session = Depends(get_db)) -> Order:
    return get_order_or_404(order_id, db)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)) -> Response:
    order = get_order_or_404(order_id, db)
    product_ids = [item.product_id for item in order.items]
    products = list(db.scalars(select(Product).where(Product.id.in_(product_ids)).with_for_update()).all())
    product_map = {product.id: product for product in products}

    for item in order.items:
        product = product_map.get(item.product_id)
        if product:
            product.quantity_in_stock += item.quantity

    db.delete(order)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
