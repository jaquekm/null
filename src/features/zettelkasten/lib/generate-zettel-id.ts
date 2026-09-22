/**
 * Id de Zettelkasten (5.11: "Nota permanente com `id_zettel` gerado") no
 * formato Luhmann clássico — data/hora compacta, sempre crescente, então
 * também serve pra ordenar notas na ordem em que foram criadas.
 */
export function generateZettelId(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
