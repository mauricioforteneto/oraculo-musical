import {describe,it,expect} from 'vitest';
import {artworkMessage} from '../../src/lib/artwork/messages';
describe('mensagens das falhas de capas',()=>{
  it('explica timeout, limites e erros HTTP por serviço',()=>{
    expect(artworkMessage('ARTWORK_PROVIDER_UNAVAILABLE:COVER_ART_ARCHIVE:TIMEOUT')).toContain('Cover Art Archive não respondeu a tempo');
    expect(artworkMessage('ARTWORK_PROVIDER_UNAVAILABLE:MUSICBRAINZ:HTTP_429')).toContain('MusicBrainz limitou as consultas (HTTP 429)');
    expect(artworkMessage('ARTWORK_PROVIDER_UNAVAILABLE:INTERNET_ARCHIVE:HTTP_503')).toContain('Internet Archive respondeu com erro HTTP 503');
    expect(artworkMessage('ARTWORK_PROVIDER_UNAVAILABLE:MUSICBRAINZ:HTTP_400')).toContain('HTTP 400');
  });
  it('explica respostas inválidas e mantém códigos antigos compatíveis',()=>{
    expect(artworkMessage('ARTWORK_PROVIDER_INVALID:COVER_ART_ARCHIVE:INVALID_RESPONSE')).toContain('Cover Art Archive retornou uma resposta');
    expect(artworkMessage('ARTWORK_PROVIDER_UNAVAILABLE:MUSICBRAINZ:TLS')).toContain('conexão segura');
    expect(artworkMessage('ARTWORK_PROVIDER_UNAVAILABLE:MUSICBRAINZ:DNS')).toContain('localizar MusicBrainz');
    expect(artworkMessage('ARTWORK_PROVIDER_UNAVAILABLE')).toContain('indisponível');
    expect(artworkMessage('sensitive arbitrary text')).not.toContain('sensitive');
  });
});
