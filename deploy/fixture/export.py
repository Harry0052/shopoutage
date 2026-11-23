# Export committed POS orders and on-hand stock. Runs inside `odoo shell`.
import json

product = env["product.product"].search([("default_code", "=", "S-001")], limit=1)
orders = env["pos.order"].search([("state", "in", ["paid", "done", "invoiced"])])
rows = []
for order in orders:
    for line in order.lines:
        if product and line.product_id.id != product.id:
            continue
        rows.append({
            "intentId": order.uuid or order.pos_reference or str(order.id),
            "sourceRowId": f"pos-order-{order.id}-line-{line.id}",
            "sku": line.product_id.default_code or "",
            "quantity": int(line.qty),
            "amountCents": int(round(line.price_subtotal * 100)),
            "status": "committed",
            "orderName": order.pos_reference or order.name or "",
        })
payload = {
    "orders": rows,
    "onHand": product.qty_available if product else None,
    "sku": "S-001",
    "orderCount": len(orders),
}
with open("/fixture/export.json", "w", encoding="utf-8") as handle:
    json.dump(payload, handle)
print(json.dumps(payload))
