/** Cheap syntactic check before anything costs money. */
export function validateBrandInput(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return "Bitte einen Markennamen mit 2 bis 60 Zeichen eingeben.";
  if (/https?:|www\.|\//i.test(name)) return "Bitte nur den Markennamen eingeben, keinen Link.";
  if (!/^[\p{L}\p{N}][\p{L}\p{N}&.'’+!\- ]*$/u.test(name)) return "Der Markenname enthält ungültige Zeichen.";
  if (name.split(" ").length > 5) return "Bitte nur den Markennamen eingeben, keinen Satz.";
  if (/^(.)\1+$/i.test(name.replace(/\s/g, ""))) return "Das sieht nicht nach einer Marke aus.";
  return null;
}
