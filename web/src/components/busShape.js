// The bus drawing shared by the map markers and the legend: a side view facing right,
// coloured by CSS (.bus-body uses --bus, the line colour). Fixed markup, no user data.
export const BUS_SVG = '<svg class="bus-shape" viewBox="0 0 46 26" aria-hidden="true">'
  + '<rect class="bus-body" x="1.5" y="1.5" width="41" height="18" rx="5"/>'
  + '<rect class="bus-glass" x="35" y="4.5" width="5.5" height="8" rx="1.5"/>'
  + '<circle class="bus-wheel" cx="10" cy="20.5" r="3.6"/><circle class="bus-wheel" cx="33" cy="20.5" r="3.6"/>'
  + '</svg>';
