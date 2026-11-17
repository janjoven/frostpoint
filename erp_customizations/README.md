# Frostpoint Requisition Slip filter

Install `requisition_slip_frostpoint.js` through the ERP administrator account:

1. Open **Client Script** and add a new script named **Requisition Slip - Frostpoint Filter**.
2. Set **DocType = Requisition Slip**, **View = List**, and **Enabled = true**.
3. Paste the JavaScript file's contents and save.
4. Reopen the ERP Requisition Slip list. FROSTPOINT selects IDs matching `FRP-%`.

Keep the existing ACCSYS Client Script enabled. This script chains the current
onload and ID-field change handlers, so the source checkboxes stay synchronized
and reuse the existing ID filter. Unchecking restores the previous ID filter.
The integration API account does not need Client Script administration permissions.

AML Network uses the backend `FRP-` scope and does not display this checkbox.
ERP creates Frostpoint IDs using `FRP-RS-.YYYY.-.######`; the standard Frappe
naming-series mechanism allocates sequence numbers. No existing ERP records are
renamed. Creation remains subject to ERP Create permissions and validations.
