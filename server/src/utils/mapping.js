function mapPIvaToVatNumber(data) {
  if (data.pIva && !data.vatNumber) {
    data.vatNumber = data.pIva.startsWith('IT') ? data.pIva : 'IT' + data.pIva;
    delete data.pIva; // Rimuovi il campo obsoleto
  }
  return data;
}

export { mapPIvaToVatNumber };