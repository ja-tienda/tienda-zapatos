/**
 * Enlace instantáneo entre el panel y la tienda cuando están abiertos en el mismo navegador
 * (otra pestaña o la vista previa del panel). Los demás clientes reciben los cambios
 * con el refresco automático del catálogo cada 30 segundos.
 */
const CHANNEL = 'ja-catalog';

export function notifyCatalogChanged(): void {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage('changed');
    channel.close();
  } catch {
    // Navegador sin BroadcastChannel: la tienda se actualiza con su refresco periódico.
  }
}

export function onCatalogChanged(callback: () => void): () => void {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => callback();
    return () => channel.close();
  } catch {
    return () => {};
  }
}
