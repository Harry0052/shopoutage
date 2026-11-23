# Seed a disposable POS. Runs inside `odoo shell` after modules are installed.
import json

product = env["product.product"].search([("default_code", "=", "S-001")], limit=1)
if not product:
    product = env["product.product"].create({
        "name": "Drill Widget",
        "default_code": "S-001",
        "list_price": 5.0,
        "available_in_pos": True,
        "is_storable": True,
        "taxes_id": [(6, 0, [])],
        "sale_ok": True,
    })
location = env.ref("stock.stock_location_stock")
quant = env["stock.quant"].search([
    ("product_id", "=", product.id),
    ("location_id", "=", location.id),
], limit=1)
if not quant:
    quant = env["stock.quant"].create({
        "product_id": product.id,
        "location_id": location.id,
        "inventory_quantity": 10,
    })
else:
    quant.inventory_quantity = 10
quant.action_apply_inventory()

config = env["pos.config"].search([], limit=1)
if not config:
    config = env["pos.config"].create({"name": "ShopOutage"})
admin = env.ref("base.user_admin")
admin.write({
    "password": "shopoutage-demo",
    "groups_id": [(4, env.ref("point_of_sale.group_pos_manager").id)],
})
config = config.with_user(admin)
if config.current_session_state in (False, None, "closed"):
    config.open_ui()
session = config.current_session_id
open_error = None
if session and session.state == "opening_control":
    for method_name in ("set_opening_control", "set_cashbox_pos", "action_pos_session_open"):
        method = getattr(session, method_name, None)
        if method is None:
            continue
        try:
            if method_name == "action_pos_session_open":
                method()
            else:
                method(0, "shopoutage fixture")
            open_error = None
            break
        except Exception as error:
            open_error = f"{method_name}: {error}"
env.cr.commit()
product.invalidate_recordset()
payload = {
    "productId": product.id,
    "sku": product.default_code,
    "qtyAvailable": product.qty_available,
    "listPrice": product.list_price,
    "configId": config.id,
    "sessionId": session.id if session else None,
    "sessionState": session.state if session else None,
    "openError": open_error,
}
with open("/fixture/seed.json", "w", encoding="utf-8") as handle:
    json.dump(payload, handle)
print(json.dumps(payload))
