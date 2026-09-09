export const emoji = {
  check: "<:upsc_check_box:1529332322351190158>",
  info: "<:infoBox:1529332436742176830>",
  cross: "<:cross_box:1529332655034732584>",
  add: "<:add:1529332767626625124>",
  reset: "<:reset:1529332820936229047>",
  folder: "<:folder:1529332948468502538>",
  openfolder: "<:openfolder:1529332986162577532>",
  music: "<:icon_music:1529333273334124625>",
  right: "<:Right_Arrow:1529333438036054167>",
  left: "<:icon_left:1529333470545969182>",
  loading: "<:icons_loading:1529333527408279582>",
  get(name: string, fallback = '') {
    return (this as unknown as Record<string, string>)[name] || fallback;
  }
};

export default emoji;
