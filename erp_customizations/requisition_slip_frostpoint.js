// Frappe Client Script: DocType = Requisition Slip, View = List, Enabled = true.
// Add alongside the existing ACCSYS script. Do not replace that script.
(() => {
  const settings = (frappe.listview_settings["Requisition Slip"] ||= {});
  const previousOnload = settings.onload;
  settings.onload = function (listview) {
    previousOnload?.call(this, listview);
    if (listview.$frostpoint_checkbox) return;
    const idFilter = listview.page.fields_dict.name;
    if (!idFilter) return;
    const prefix = "FRP-%";
    const label = $('<label class="checkbox" style="margin:0 12px;align-self:center;white-space:nowrap"><input type="checkbox"><span>FROSTPOINT</span></label>')
      .appendTo(listview.filter_area.standard_filters_wrapper);
    const checkbox = label.find("input");
    listview.$frostpoint_checkbox = checkbox;
    let previousId = "";
    checkbox.prop("checked", idFilter.get_value() === prefix);
    checkbox.on("change", async () => {
      if (checkbox.prop("checked")) {
        previousId = idFilter.get_value() || "";
        await idFilter.set_value(prefix);
      } else if (idFilter.get_value() === prefix) {
        await idFilter.set_value(previousId);
      }
      listview.start = 0;
      listview.refresh();
    });
    const previousChange = idFilter.df.onchange;
    idFilter.df.onchange = function (...args) {
      checkbox.prop("checked", idFilter.get_value() === prefix);
      return previousChange?.apply(this, args);
    };
  };
})();
