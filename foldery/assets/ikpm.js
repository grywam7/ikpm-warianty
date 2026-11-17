// app/javascript/money.js
var PLN = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", useGrouping: "always" });
var DECIMAL = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });
var formatPLN = (value) => PLN.format(value);
var formatDecimal = (value) => DECIMAL.format(value);

// lib/scripts/ui_study/kit/ikpm.js
var roundHalfUp = (value) => Math.round(Math.round(value * 1e6) / 1e4) / 100;
var parseNumber = (text) => {
  const _text = String(text ?? "").trim().replace(",", ".");
  return /^-?(\d+(\.\d*)?|\.\d+)$/.test(_text) ? Number(_text) : NaN;
};
var valueOf = (value) => value === null || value === void 0 || value === "" ? null : Number(value);
var dimension = (room, field) => valueOf(room[field]) ?? 0;
var floorArea = (room) => valueOf(room.floor_area_override) ?? dimension(room, "length") * dimension(room, "width");
var ceilingArea = (room) => valueOf(room.ceiling_area_override) ?? floorArea(room);
var perimeter = (room) => valueOf(room.perimeter_override) ?? 2 * (dimension(room, "length") + dimension(room, "width"));
var wallArea = (room) => valueOf(room.wall_area_override) ?? perimeter(room) * dimension(room, "height") - dimension(room, "holes_area");
var areaFor = (room, areaType) => {
  switch (areaType) {
    case "floor":
      return floorArea(room);
    case "ceiling":
      return ceilingArea(room);
    case "wall":
      return wallArea(room);
    case "wall_ceiling":
      return wallArea(room) + ceilingArea(room);
    case "perimeter":
      return perimeter(room);
    default:
      return 0;
  }
};
var defaultQuantity = (job, room) => {
  if (job.area_type === "manual") return 1;
  const _area = roundHalfUp(areaFor(room, job.area_type));
  return _area > 0 ? _area : 1;
};
var laborUnitCost = (job) => valueOf(job.contractor_price) ?? valueOf(job.average_price) ?? 0;
var unitCost = (job) => laborUnitCost(job) + (valueOf(job.effective_material_unit_cost) ?? 0);
var clientUnitPrice = (job, markupPercent) => roundHalfUp(unitCost(job) * (1 + Number(markupPercent) / 100));
var lineTotal = (job, markupPercent) => roundHalfUp(clientUnitPrice(job, markupPercent) * Number(job.quantity));
var quoteTotals = (quote) => {
  const _net = roundHalfUp(quote.rooms.flatMap((room) => room.jobs).reduce((sum, job) => sum + lineTotal(job, quote.markup_percent), 0));
  const _vat = roundHalfUp(_net * Number(quote.vat_rate) / 100);
  return { net: _net, vat: _vat, gross: roundHalfUp(_net + _vat) };
};
export {
  areaFor,
  ceilingArea,
  clientUnitPrice,
  defaultQuantity,
  floorArea,
  formatDecimal,
  formatPLN,
  laborUnitCost,
  lineTotal,
  parseNumber,
  perimeter,
  quoteTotals,
  roundHalfUp,
  unitCost,
  wallArea
};
