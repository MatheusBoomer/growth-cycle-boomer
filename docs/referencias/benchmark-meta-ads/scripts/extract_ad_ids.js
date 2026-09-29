// extract_ad_ids.js
//
// Executar (via ferramenta de JavaScript do navegador) na página de resultados
// da Biblioteca de Anúncios do Meta, DEPOIS de já ter rolado a página até o fim
// para carregar todos os anúncios ativos daquela conta.
//
// Retorna até 10 IDs únicos de anúncio, na ordem em que aparecem na página
// (que já vem por padrão dos mais recentes para os mais antigos).
//
// Nota: o processo manual original limitava a extração a 8 IDs (slice(0, 8)),
// o que conflitava com a regra de "colete no máximo 10 IDs por anunciante".
// Aqui o slice foi ajustado para 10 para bater com essa regra.

(() => {
  const allText = document.body.innerText;
  const matches = allText.match(/Identificação da biblioteca: (\d+)/g);
  const uniqueIds = [...new Set(
    matches ? matches.map(m => m.replace('Identificação da biblioteca: ', '')) : []
  )];
  return JSON.stringify({ count: uniqueIds.length, ids: uniqueIds.slice(0, 10) });
})();
