# Projeto inicial — Plataforma Imobiliária

Especificação do cliente, conforme recebida. É a fonte de verdade do produto.
Quando o código divergir daqui, o código está errado — ou este documento
precisa ser atualizado por decisão explícita.

---

## 1. Conceito

Site imobiliário próprio, em versão web responsiva, como ambiente centralizado para:

- proprietários cadastrarem imóveis;
- compradores cadastrarem o imóvel que procuram;
- a plataforma cruzar oferta e demanda;
- compradores demonstrarem interesse;
- o Administrador Master receber e controlar todos os interessados;
- o Master atender ou encaminhar para corretores autorizados;
- corretores conduzirem visitas, propostas e negociações;
- toda comunicação comercial ocorrer dentro da intermediação da plataforma.

Dois bancos principais:

- **Banco de oferta** — imóveis para venda ou locação, cadastrados pelos
  proprietários e aprovados pelo Master.
- **Banco de demanda** — compradores informando exatamente o que procuram:
  características, localização e demais necessidades.

## 2. Principal diferencial

Intermediação centralizada pelo Administrador Master. Proprietário e comprador
não têm contato direto. O sistema impede a exposição dos dados de contato entre
as partes.

```
PROPRIETÁRIO → PLATAFORMA → MASTER → CORRETOR AUTORIZADO → COMPRADOR
PROPRIETÁRIO → PLATAFORMA → MASTER → COMPRADOR          (atendimento do Master)
```

## 3. Regra absoluta de contato

O comprador não pode visualizar, do proprietário: WhatsApp, telefone, e-mail
pessoal, outros dados de contato, nem qualquer botão de contato direto.

O proprietário não pode visualizar, do comprador: WhatsApp, telefone, e-mail
pessoal, outros dados de contato, nem qualquer botão de contato direto.

Todos os contatos passam pela plataforma.

## 4. Regra absoluta de valores

O preço do imóvel não é exibido publicamente ao comprador.

**Exibido** na página pública: fotos, descrição, localização, bairro,
características, quartos, suítes, vagas, metragem, área construída, área do
terreno, condomínio quando aplicável, informações relevantes do proprietário e
demais informações autorizadas pelo Master.

**Não exibido:** preço de venda, valor de aluguel, valor de entrada, valor
mínimo de negociação, condições financeiras particulares, margem de negociação
do proprietário.

O comprador clica em **TENHO INTERESSE** para solicitar informações comerciais.

## 5. Fluxo do interesse

1. O sistema registra o interesse.
2. O proprietário não recebe o contato direto do comprador.
3. O comprador não recebe o contato direto do proprietário.
4. O lead entra no painel do Master.
5. O Master analisa.
6. O Master pode: assumir o atendimento; encaminhar a um corretor autorizado;
   solicitar informações adicionais; verificar compatibilidade; iniciar a
   negociação.
7. O corretor recebe somente os dados necessários ao atendimento.
8. O proprietário recebe somente as informações necessárias, por intermédio da
   plataforma, do Master ou do corretor.

## 6. Página pública do imóvel

- **Galeria:** várias fotos, foto principal, organização das imagens.
- **Informações:** tipo, localização, bairro, cidade, metragem, quartos,
  suítes, banheiros, vagas, características, descrição, comodidades,
  informações adicionais.
- **Localização:** região, bairro, mapa aproximado, pontos de referência. A
  localização exata pode ser protegida conforme configuração do Master.
- **Área comercial:** em vez do preço, "VALOR SOB CONSULTA" ou "TENHA ACESSO ÀS
  CONDIÇÕES COMERCIAIS", com o botão **TENHO INTERESSE**.

## 7. Banco de oferta

Tipos: casa, apartamento, cobertura, lote, terreno, imóvel comercial, sala,
loja, galpão, sítio, fazenda, imóvel em condomínio, imóvel novo, imóvel usado,
lançamento.

Cada imóvel fica vinculado ao proprietário responsável e entra como
**AGUARDANDO APROVAÇÃO**. Só após aprovação do Master fica disponível aos
compradores.

## 8. Cadastro do proprietário

Cadastro, login, senha, perfil, cadastro dos imóveis, fotos, descrição,
características, documentos solicitados, status dos imóveis, histórico.

O proprietário acompanha seus imóveis, mas não acessa os dados pessoais dos
compradores.

## 9. Banco de demanda

O comprador cadastra o que procura mesmo que ainda não exista imóvel
compatível. Exemplo: Pedro procura casa em Belo Horizonte, orçamento de
R$ 500.000, 3 quartos, suíte e garagem. Quando surgir imóvel compatível, o
sistema gera uma correspondência.

## 10. Cadastro do comprador

Nome, dados de cadastro, cidade/região, tipo de imóvel, finalidade,
localização desejada, quartos, suítes, vagas, metragem, características, faixa
financeira, forma pretendida de pagamento, financiamento quando aplicável,
observações e características específicas.

## 11. Matching entre oferta e demanda

O sistema compara o que o proprietário tem com o que o comprador procura, e
apresenta ao comprador os imóveis compatíveis para que ele demonstre interesse.

## 12. O comprador não vê o preço

Regra técnica do projeto. O preço existe no banco para Master, corretores
autorizados, controle interno, negociação, relatórios e gestão comercial.

Preço cadastrado: R$ 650.000 → visualização do comprador: **VALOR SOB CONSULTA**.

## 13. O comprador não vê o contato do proprietário

Mesmo cadastrados, WhatsApp, telefone e e-mail ficam protegidos.

## 14. O proprietário não vê o contato do comprador

WhatsApp, telefone, e-mail, endereço pessoal e dados particulares
desnecessários ficam protegidos.

## 15. Administrador Master

Nível máximo de administração. Somente o Master pode: aprovar e bloquear
proprietários; aprovar e rejeitar imóveis; editar informações; visualizar
valores, dados internos, compradores, demandas e leads; cadastrar, autorizar,
bloquear e remover corretores; distribuir e transferir leads; acompanhar
negociações e propostas; visualizar histórico; controlar usuários e permissões;
visualizar relatórios; administrar todo o sistema.

## 16. Corretores autorizados

Cada corretor tem login, senha, perfil profissional, status
autorizado/bloqueado, carteira de clientes, leads atribuídos, imóveis
atribuídos, agenda, negociações e histórico. Não tem poder administrativo.

## 17. Hierarquia

```
ADMINISTRADOR MASTER
    ↓
CORRETORES AUTORIZADOS
    ↓
COMPRADORES / PROPRIETÁRIOS
```

O corretor não pode: criar outro administrador; autorizar outro corretor;
alterar regras do sistema; acessar funções administrativas do Master;
transferir leads sem autorização; liberar contato direto entre comprador e
proprietário.

## 18. Distribuição de leads

Todo interesse chega ao Master, que pode: atender pessoalmente; encaminhar a um
corretor autorizado; manter o lead em análise; transferir a outro corretor. O
sistema registra quem recebeu o lead.

## 19. CRM — etapas do funil

1. Novo interesse · 2. Lead recebido · 3. Em atendimento · 4. Imóvel
selecionado · 5. Visita solicitada · 6. Visita agendada · 7. Visita realizada ·
8. Proposta · 9. Contraproposta · 10. Negociação · 11. Documentação ·
12. Financiamento · 13. Contrato · 14. Fechado · 15. Perdido · 16. Cancelado

## 20. Propostas

O comprador manifesta proposta pela plataforma. A proposta é encaminhada ao
Master ou ao corretor responsável. O proprietário a recebe por intermédio da
plataforma. Não há troca direta de contatos.

## 21. Negociação

Toda negociação fica registrada. Exemplo: preço interno R$ 650.000 → proposta
R$ 600.000 → contraproposta R$ 630.000 → nova proposta R$ 620.000. Todo o
histórico permanece no sistema.

## 22. Visitas

O comprador solicita visita; o pedido vai ao Master ou ao corretor. O sistema
registra data, horário, imóvel, comprador, corretor, status, observações e
resultado.

## 23. Favoritos

Favoritar, remover, visualizar salvos e receber notificações de alterações
relevantes.

## 24. Alertas de match

"Encontramos um imóvel compatível com o que você procura." O comprador acessa o
imóvel e decide se demonstra interesse.

## 25. Comunicação interna

Comprador ↔ corretor · Proprietário ↔ corretor · Comprador ↔ Master ·
Proprietário ↔ Master.

As mensagens podem ser armazenadas no histórico da negociação. O sistema não
expõe automaticamente WhatsApp ou telefone entre as partes.

## 26. Segurança dos dados

Níveis de acesso: Master, acesso completo autorizado; corretor, somente os
dados necessários ao atendimento; comprador e proprietário, somente as
informações permitidas.

## 27. Status do imóvel

Aguardando aprovação · aprovado · publicado · reservado · em negociação ·
vendido · alugado · pausado · rejeitado · cancelado.

## 28. Status do comprador

Novo · demanda cadastrada · procurando · imóvel sugerido · interessado · em
atendimento · visita · proposta · negociação · documentação · financiamento ·
contrato · fechado · perdido · inativo.

## 29. Painel do proprietário

Meus imóveis, status, quantidade de interessados, solicitações, propostas
recebidas, visitas, negociações, histórico — sempre dentro da regra de
intermediação, sem acesso aos dados pessoais do comprador.

## 30. Painel do comprador

Meu perfil, imóvel que procuro, minhas demandas, imóveis encontrados, imóveis
compatíveis, favoritos, meus interesses, visitas, propostas, negociações,
histórico, mensagens com o Master ou corretor. O preço continua protegido até o
atendimento comercial.

## 31. Painel do corretor

Leads recebidos, compradores atribuídos, proprietários relacionados, imóveis
atribuídos, agenda, visitas, propostas, negociações, mensagens, histórico,
status dos atendimentos.

## 32. Painel Master

Centro da operação: compradores, proprietários, imóveis, demandas, matches,
interessados, leads, corretores, negociações, propostas, visitas, imóveis
vendidos, imóveis alugados, negociações abertas e encerradas.

## 33. Relatórios

Quantidade de compradores, proprietários, imóveis, demandas e interesses; leads
por corretor; imóveis mais acessados e mais favoritados; quantidade de visitas,
propostas, negociações, vendas e locações.

## 34. Regras contra contato direto

Ocultação de telefone, WhatsApp e e-mail; bloqueio de links externos em campos
específicos; controle de mensagens; registro de histórico; auditoria; controle
de usuários; bloqueio de usuários quando necessário.

## 35. Proteção do valor do imóvel

O valor existe no cadastro interno (ex.: R$ 700.000); o comprador vê "valor sob
consulta". Master e corretor conhecem as condições comerciais; o comprador as
recebe durante o atendimento.

## 36. Site público

- **Home:** logo, apresentação, busca, botão Comprar, botão Procurar imóvel,
  botão Cadastrar imóvel, botão Entrar, chamada para cadastro de demanda.
- **Imóveis:** listagem, filtros, fotos, características, localização,
  descrição, botão TENHO INTERESSE.
- **Cadastre o imóvel:** área do proprietário.
- **Procure seu imóvel:** área do comprador para cadastrar demanda.
- **Login.**

## 37. Regra sobre imóveis externos

Não haverá importação automática de anúncios externos, links para anúncios
externos, fotos copiadas de outros portais, botão que leve o comprador a outro
portal, nem busca automática em outros portais. O banco de oferta é formado
pelos imóveis cadastrados na própria plataforma e aprovados pelo Master.

## 38. Banco de dados

Separar ao menos: usuários, compradores, proprietários, corretores, imóveis,
fotos, demandas, interesses, matches, leads, propostas, negociações, visitas,
mensagens, documentos, histórico, permissões, notificações, auditoria.

## 39. Tecnologia inicial

Site responsivo em celular, tablet e computador. Não é necessário começar com
aplicativo. A estrutura deve estar preparada para receber depois: aplicativo,
IA, CRM avançado, financiamento, assinatura digital, pagamentos, integração
bancária, locação, administração de imóveis, parceiros, incorporadoras e
marketplace.

## 40. Primeira versão — MVP

**Comprador:** cadastro, login, perfil, cadastro do imóvel que procura, banco
de demanda, visualização de imóveis, fotos, descrição, localização,
características, favoritos, matching, botão TENHO INTERESSE, histórico de
interesses.

**Proprietário:** cadastro, login, cadastro do imóvel, fotos, descrição,
características, status, painel de imóveis, informações comerciais internas,
propostas, negociações.

**Master:** dashboard, compradores, proprietários, imóveis, demandas,
interesses, matches, leads, corretores, aprovação de imóveis, aprovação de
usuários, distribuição de leads, transferência de leads, acompanhamento de
negociação, controle de valores, histórico, relatórios.

**Corretor:** login, perfil, leads atribuídos, compradores atribuídos, imóveis
atribuídos, agenda, visitas, propostas, negociações, mensagens, histórico.

## 41. Regra central do MVP

> A plataforma será responsável pela intermediação centralizada entre
> compradores e proprietários. O comprador não terá acesso direto aos dados de
> contato do proprietário e o proprietário não terá acesso direto aos dados de
> contato do comprador. O preço e as condições comerciais do imóvel também não
> serão exibidos publicamente ao comprador. O comprador poderá visualizar
> fotos, descrição, localização e características do imóvel e, caso tenha
> interesse, deverá utilizar o botão "TENHO INTERESSE". O interesse será
> direcionado ao Administrador Master, que poderá realizar o atendimento ou
> encaminhá-lo a um corretor autorizado. Toda proposta, visita, negociação e
> comunicação comercial deverá ocorrer por meio da plataforma, do Administrador
> Master ou de corretor autorizado.

## 42. Princípio de governança

O Master tem a visão geral da operação. Nenhum corretor assume controle da
plataforma. Nenhum proprietário acessa diretamente compradores. Nenhum
comprador acessa diretamente proprietários. Nenhuma parte visualiza informações
comerciais internas não liberadas.

## 43. Evolução futura

- **Fase 2:** CRM avançado, chat completo, agenda, visitas, propostas,
  negociação, documentos.
- **Fase 3:** financiamento, FGTS, parceiros bancários, assinatura digital,
  contratos, ITBI, cartório.
- **Fase 4:** locação, análise de crédito, garantias, administração de aluguel,
  manutenção, vistoria.
- **Fase 5:** aplicativos do comprador, do proprietário, do corretor e Master.
- **Fase 6:** inteligência artificial, matching avançado, atendimento
  automatizado, análise de imóveis e de demanda, previsão de oportunidades,
  assistente do corretor.

## 44. Regra de ouro

Não é um site onde proprietário e comprador se encontram. É um **sistema de
intermediação imobiliária centralizada**, com banco de oferta, banco de
demanda, matching, Administrador Master, corretores autorizados, CRM,
propostas, negociação, controle de contatos, controle de valores e histórico.

## 45. Experiência do comprador

Entra no site → procura → encontra → vê fotos, descrição, localização e
características → **não vê o preço** → **não vê o WhatsApp do proprietário** →
clica em TENHO INTERESSE → o interesse chega ao Master → o Master analisa →
atende ou encaminha a corretor → o corretor entra em contato → o comprador
recebe as condições comerciais → visita → proposta → o proprietário recebe a
proposta pela plataforma ou pelo corretor → negociação → documentação →
contrato → fechamento.

## 46. Experiência do proprietário

Cadastra o imóvel → envia fotos e informações → fica aguardando aprovação → o
Master analisa e aprova → o imóvel entra no banco de oferta → compradores
compatíveis o encontram → o comprador demonstra interesse → o interesse chega
ao Master → Master ou corretor atende → a proposta é apresentada ao
proprietário → a negociação ocorre por intermédio da plataforma → fechamento.

## 47. Regra final de privacidade comercial

Informações protegidas: telefone, WhatsApp e e-mail do proprietário; telefone,
WhatsApp e e-mail do comprador; preço interno do imóvel; valor mínimo
aceitável; condições particulares; informações internas de negociação;
informações internas de comissão; dados administrativos.

Disponibilizadas apenas conforme o nível de permissão de cada usuário.

## 48. Objetivo da primeira versão

Construir uma base sólida:

```
SITE + BANCO DE OFERTA + BANCO DE DEMANDA + MATCHING + MASTER
     + CORRETORES AUTORIZADOS + LEADS + INTERESSE
     + CONTROLE DE CONTATO + CONTROLE DE VALORES
```

A estrutura deve permitir acrescentar os módulos avançados depois, sem
reconstruir a plataforma.

---

# Emendas

Decisões tomadas depois da spec original. Cada uma diz o que mudou e por quê,
para que a diferença entre o documento e o sistema nunca seja acidental.

## E1 — Faixa de preço na busca pública (2026-10-05)

**Muda:** §4 e §12.

O layout aprovado pelo cliente tem um filtro de valor na busca pública. Como
qualquer filtro por preço é um oráculo de preço, a escolha não é "vazar ou não
vazar", e sim qual a resolução do vazamento. Decisão de Franklin: **faixas
fixas e largas**.

- Venda: até R$ 300 mil · R$ 300–600 mil · R$ 600 mil–1 mi · acima de R$ 1 mi.
- Locação: até R$ 2 mil · R$ 2–5 mil · R$ 5–10 mil · acima de R$ 10 mil.

Continua protegido, e é o que sustenta a intermediação (§35, §47): valor
pedido, mínimo aceitável, entrada, condições e margem de negociação. O card e a
página do imóvel seguem com "Entre em contato para saber o valor".

A faixa é coluna **derivada** do preço privado, calculada por trigger. Ninguém
a escreve. Estreitar as faixas aumenta a resolução do oráculo e exige decisão
explícita do cliente — `supabase/tests/0003_price_band_isolation.sql` falha se
alguém estreitar.

## E2 — Marca (2026-10-05)

O produto chama-se **TSV Imóveis**. `imobi` é só o nome do repositório.

## E3 — Operador único (2026-10-05)

O MVP atende uma imobiliária, com um Master. A plataforma não é vendida a
várias imobiliárias nesta fase. Isso dispensa a camada de organizações,
assentos e planos; a estrutura permite acrescentá-la depois.
