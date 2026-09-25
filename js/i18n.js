/* ============================================================
   NAVLOG AMAZÔNIA — I18N (idioma da interface)
   Traduz só o "chrome" do app (menus, botões, rótulos, mensagens).
   NÃO traduz dado/conteúdo: nomes de município, nomes de calha,
   nomes de embarcação, observações pessoais, nome da empresa — isso
   é conteúdo real (nomes próprios ou texto digitado por alguém), não
   texto de interface. Preferência de cada aparelho (localStorage),
   não é dado da empresa — por isso não vem do Supabase, igual o tema.
   ============================================================ */

var LANG_STORAGE_KEY = 'navlog-lang';
var LANGS = ['pt', 'en', 'es', 'zh'];
var LANG_META = {
  pt: { label: 'PT', nome: 'Português' },
  en: { label: 'EN', nome: 'English' },
  es: { label: 'ES', nome: 'Español' },
  zh: { label: '中文', nome: '中文' }
};
var LANG = 'pt';

var I18N = {

  pt: {
    tab_rotas: 'Rotas', tab_info: 'Informações', tab_mapa: 'Mapa', tab_noticias: 'Notícias', tab_clima: 'Clima',
    tab_config: 'Configurações',
    theme_btn_title: 'Trocar tema claro/escuro',
    logout_title: 'Sair',
    lang_btn_title: 'Trocar idioma',
    push_btn_title_off: 'Ativar notificações',
    push_btn_title_on: 'Notificações ativadas (toque pra desativar)',
    push_btn_title_negado: 'Notificações bloqueadas no navegador',
    push_indisponivel_msg: 'Seu navegador não suporta notificações push.',
    push_negado_msg: 'As notificações foram bloqueadas nas configurações do navegador. Pra ativar, permita notificações pra este site nas configurações do seu navegador/aparelho.',
    push_erro_msg: 'Não consegui ativar as notificações agora. Tente de novo em instantes.',
    search_ph: 'Buscar município ou código...',
    hero_title: 'Rotas fluviais do Amazonas',
    hero_sub_tpl: '{calhas} calhas · {municipios} municípios',

    login_email_label: 'E-mail', login_senha_label: 'Senha', login_btn: 'Entrar',
    login_entering: 'Entrando...',
    login_err_credentials: 'E-mail ou senha incorretos.',
    login_err_connection: 'Falha de conexão. Tente novamente.',
    login_hint_html: 'Sua conta é criada pelo administrador do sistema.<br>Não tem acesso ainda? Fale com quem administra o NavLog.',

    live_connecting: 'Conectando...',
    live_live_title: 'Ao vivo — atualizações da equipe em tempo real',
    live_offline_title: 'Sem conexão em tempo real — pode não ver atualizações da equipe agora',
    alert_dot_title: 'Nível do rio em faixa crítica',

    config_no_permission: 'Você não tem permissão pra ver Configurações.',
    erro_salvar_tpl: 'Não consegui salvar: {msg}',
    empresa_card_title: '🏢 Dados da empresa',
    empresa_card_sub: 'Nome e logo aparecem no cabeçalho pra todo mundo',
    empresa_nome_label: 'Nome da empresa', empresa_nome_ph: 'Ex: Facil Express',
    empresa_logo_label: 'URL do logo (imagem)', empresa_logo_ph: 'https://...',
    empresa_save_btn: '✓ Salvar dados da empresa',

    salvando: 'Salvando...', restaurando: 'Restaurando...', salvo_ok: '✓ Salvo!', restaurado_ok: '✓ Restaurado!',
    busca_sem_resultado: 'Nenhum resultado encontrado.',

    kpi_tt_amazon: 'TT Amazon', kpi_distancia: 'Distância', kpi_transit_rota: 'Transit rota', kpi_transit: 'Transit',
    dias_saida_view_label: '🗓️ Dias de saída do porto', dias_saida_edit_label: 'Dias de saída do porto',
    dias_nao_informado: 'Não informado.',
    preco_saca_title: '💰 PREÇO POR SACA',
    preco_seca_view: '🏜️ Seca', preco_seca_edit: '🏜️ Seca (R$)',
    preco_cheia_view: '🌊 Cheia', preco_cheia_edit: '🌊 Cheia (R$)',
    per_saca_suffix: '/saca',
    emb_mais_usadas: 'Embarcações mais usadas', emb_empty: 'Nenhuma embarcação cadastrada.',
    observacoes_label: 'Observações', observacoes_hint: '(só você vê — fica na sua conta)',
    observacoes_ph_tpl: 'Anotações pessoais sobre {nome}...',
    ta_label: 'Transit Time Amazon (dias)',
    restaurar_btn: '⟲ Restaurar original', salvar_btn: '✓ Salvar',
    emb_add_btn: '+ Adicionar embarcação', avaliacao_label: 'Avaliação',
    emb_nome_ph: 'Nome da embarcação', emb_tt_ph: 'dias',
    emb_avaliacao_baixa_title: 'Todas as embarcações avaliadas têm nota baixa',
    emb_avaliacao_baixa_curto: 'Avaliação baixa',
    emb_avaliacao_baixa_aviso: 'Todas as embarcações avaliadas aqui estão com nota baixa (1-2 estrelas) — pode valer a pena rever a operação neste município.',
    contato_title: 'Contato (agente local/porto)',
    contato_nome_label: 'Nome', contato_nome_ph: 'Nome do contato',
    contato_tel_label: 'Telefone', contato_tel_ph: '(00) 00000-0000',
    contato_nao_informado: 'Nenhum contato cadastrado.',
    rota_calc_btn_title: 'Distância entre dois municípios',
    tile_toggle_title: 'Alternar mapa claro/escuro',
    map_toolbar_toggle_title: 'Filtros e ferramentas do mapa',
    rota_calc_title: 'Distância entre dois municípios', rota_calc_badge: 'ESTIMATIVA',
    rota_calc_origem_label: 'De', rota_calc_destino_label: 'Para',
    rota_calc_resultado_distancia: 'Distância estimada', rota_calc_resultado_tempo: 'Tempo estimado',
    rota_calc_dias_tpl: '{dias} dias',
    rota_calc_hint: 'Escolha os dois municípios pra ver a distância e o tempo estimados.',
    rota_calc_nota_mesmo: 'Mesmo município.',
    rota_calc_nota_mesma_calha: 'Estimativa considerando um trajeto contínuo na mesma calha.',
    rota_calc_nota_via_hub: 'Estimativa considerando passagem por Manaus (calhas diferentes) — pode não refletir o trajeto real.',
    rota_calc_limpar_btn: '✕ Limpar',

    calha_word: 'Calha', municipios_word: 'municípios', calhas_word: 'calhas', total_word: 'total',
    rota_fluvial_title: 'Rota fluvial', rota_rodoviaria_title: 'Rota rodoviária',
    obs_saved_dot_title: 'Tem observação salva',

    seg_aduaneiro_label: 'Aduaneiro', seg_aduaneiro_curto: 'ADUANEIRO',
    seg_aduaneiro_desc: 'Município de fronteira / eixo aduaneiro. Foco da Receita Federal e da Polícia Federal: combate ao contrabando, descaminho de mercadorias e tráfico internacional de drogas.',
    seg_corredor_label: 'Corredor de Escoamento', seg_corredor_curto: 'CORREDOR',
    seg_corredor_desc: 'Município do corredor de escoamento fluvial (calhas Solimões, Amazonas, Japurá e Purus), rota de mercadorias e drogas em direção a Manaus ou ao Nordeste. Fiscalização puramente policial, com interceptação de cargas.',
    seg_ponto_atencao: 'Ponto de atenção:',

    niv_empty_html: 'Ainda não tem nenhuma leitura do nível do rio salva.<br>A coleta automática roda 1x por dia — volte mais tarde.',
    niv_label: '🌊 Nível do Rio Negro', niv_fonte_label: 'Fonte:', niv_unit: 'metros',
    trend_subindo: 'Enchendo', trend_descendo: 'Vazando', trend_estavel: 'Estável',
    niv_hoje: 'hoje', niv_atualizado_em: 'Atualizado em',
    niv_mesmo_dia_ano_passado: 'Mesmo dia do ano passado',
    niv_proximo_mesmo_dia: 'Próximo do mesmo dia, ano passado',
    niv_historico_title: 'Histórico', niv_historico_range_tpl: 'últimas {n} leituras',
    niv_feed_title: 'Notícias do nível',
    niv_feed_estavel_tpl: 'Nível estável em {v}m',
    niv_feed_trend_tpl: '{trend} {cm}cm — nível em {v}m',
    niv_gauge_seca: 'Seca', niv_gauge_normal: 'Normal', niv_gauge_alerta_grupo: 'Atenção/Alerta/Emergência',
    niv_gauge_note: 'Lado da cheia usa as cotas oficiais da Defesa Civil de Manaus/SGB (atenção 27,00m · alerta 27,50m · emergência 29,00m). Não existe cota oficial de seca — o corte de 19,00m é uma referência informal, com base na mínima histórica (12,70m, a pior seca em 121 anos, out/2023).',
    regime_seca_severa: 'Seca severa', regime_seca: 'Seca', regime_normal: 'Normal',
    regime_atencao: 'Atenção', regime_alerta: 'Alerta (cheia)', regime_emergencia: 'Emergência (cheia)',
    alert_text_seca_severa: 'Rio numa faixa de seca severa, próxima da mínima histórica. Pode afetar a passagem de embarcações com mais calado em trechos rasos.',
    alert_text_atencao: 'Rio na cota de atenção (Defesa Civil de Manaus/SGB). Ainda sem restrição, mas vale acompanhar de perto.',
    alert_text_alerta: 'Rio na cota de alerta/inundação (Defesa Civil de Manaus/SGB). Pode afetar áreas mais baixas e o acesso a alguns portos/trapiches.',
    alert_text_emergencia: 'Rio na cota de emergência (Defesa Civil de Manaus/SGB) — nível de inundação severa.',
    niv_alert_title_tpl: 'Nível do rio em {regime}',

    clima_title: 'Clima nos municípios', clima_hub_badge: 'CAPITAL · HUB', clima_atualizado_tpl: 'atualizado às {hora}',
    clima_atualizar_agora: 'Atualizar agora', clima_fonte_nota: 'Dado de modelo meteorológico (Open-Meteo), não é radar ao vivo — chuva forte e repentina, bem localizada, pode demorar alguns minutos pra aparecer aqui. Toque em ⟳ pra buscar de novo agora.',
    clima_radar_mini_title: 'Radar de chuva agora', clima_radar_indisponivel: 'Radar indisponível no momento',
    radar_btn_label: 'Radar', radar_ligar_title: 'Ver radar de chuva ao vivo (radar/satélite) sobre o mapa', radar_desligar_title: 'Desligar o radar de chuva',
    radar_pausar_title: 'Pausar animação', radar_tocar_title: 'Tocar animação', radar_carregando: 'Carregando radar…',
    radar_agora: 'agora', radar_min_atras_tpl: '{n}min atrás', radar_min_previsao_tpl: '+{n}min · previsão',
    radar_fonte_nota: 'Radar + satélite: RainViewer',
    clima_sensacao_tpl: 'sensação {v}°', clima_chuva_title: 'Chuva agora', clima_vento_title: 'Vento agora',
    clima_erro_html: 'Não foi possível carregar o clima agora. Verifique a internet e tente de novo.',
    clima_tentar_de_novo: 'Tentar de novo',
    clima_desc_limpo: 'Céu limpo', clima_desc_parcial: 'Parcialmente nublado', clima_desc_nublado: 'Nublado',
    clima_desc_nevoa: 'Névoa/neblina', clima_desc_garoa: 'Garoa', clima_desc_chuva: 'Chuva',
    clima_desc_pancada: 'Pancada de chuva', clima_desc_neve: 'Precipitação gelada', clima_desc_trovoada: 'Trovoada',
    clima_desc_indef: 'Sem dados',
    clima_aqi_title_tpl: 'Qualidade do ar (índice europeu) · PM2,5 {pm25}µg/m³ · PM10 {pm10}µg/m³',
    clima_aqi_indef: 'Ar: sem dados',
    clima_aqi_section_title: 'Qualidade do ar',
    clima_previsao_title: 'Próximos dias', clima_hoje: 'Hoje',
    aqi_bom: 'Ar bom', aqi_razoavel: 'Ar razoável', aqi_moderado: 'Ar moderado',
    aqi_ruim: 'Ar ruim', aqi_muito_ruim: 'Ar muito ruim', aqi_extremo: 'Ar extremamente ruim',
    clima_ar_alert_dot_title: 'Qualidade do ar ruim em algum município',
    clima_ar_alerta_title_tpl: 'Qualidade do ar ruim em {n} município(s)',
    clima_ar_alerta_mais_tpl: ' e mais {n}',

    map_filter_todas: 'TODAS', map_popup_inicio: 'Início', map_popup_fim: 'Fim',
    ver_detalhes: 'ver detalhes ›', min_abbr: 'mín', max_abbr: 'máx',

    dl_seg: 'S', dl_ter: 'T', dl_qua: 'Q', dl_qui: 'Q', dl_sex: 'S', dl_sab: 'S', dl_dom: 'D',
    dn_seg: 'Segunda-feira', dn_ter: 'Terça-feira', dn_qua: 'Quarta-feira', dn_qui: 'Quinta-feira',
    dn_sex: 'Sexta-feira', dn_sab: 'Sábado', dn_dom: 'Domingo'
  },

  en: {
    tab_rotas: 'Routes', tab_info: 'Info', tab_mapa: 'Map', tab_noticias: 'River level', tab_clima: 'Weather',
    tab_config: 'Settings',
    theme_btn_title: 'Switch light/dark theme',
    logout_title: 'Log out',
    lang_btn_title: 'Change language',
    push_btn_title_off: 'Enable notifications',
    push_btn_title_on: 'Notifications on (tap to turn off)',
    push_btn_title_negado: 'Notifications blocked in browser',
    push_indisponivel_msg: 'Your browser does not support push notifications.',
    push_negado_msg: 'Notifications were blocked in your browser settings. To enable them, allow notifications for this site in your browser/device settings.',
    push_erro_msg: 'Could not enable notifications right now. Please try again shortly.',
    search_ph: 'Search town or code...',
    hero_title: 'Amazonas river routes',
    hero_sub_tpl: '{calhas} routes · {municipios} towns',

    login_email_label: 'Email', login_senha_label: 'Password', login_btn: 'Log in',
    login_entering: 'Logging in...',
    login_err_credentials: 'Incorrect email or password.',
    login_err_connection: 'Connection failed. Please try again.',
    login_hint_html: 'Your account is created by the system administrator.<br>Don’t have access yet? Contact whoever manages NavLog.',

    live_connecting: 'Connecting...',
    live_live_title: 'Live — real-time team updates',
    live_offline_title: 'No real-time connection — you may miss the team’s updates right now',
    alert_dot_title: 'River level in a critical range',

    config_no_permission: 'You don’t have permission to view Settings.',
    erro_salvar_tpl: 'Couldn’t save: {msg}',
    empresa_card_title: '🏢 Company info',
    empresa_card_sub: 'Name and logo shown in the header for everyone',
    empresa_nome_label: 'Company name', empresa_nome_ph: 'e.g. Facil Express',
    empresa_logo_label: 'Logo URL (image)', empresa_logo_ph: 'https://...',
    empresa_save_btn: '✓ Save company info',

    salvando: 'Saving...', restaurando: 'Restoring...', salvo_ok: '✓ Saved!', restaurado_ok: '✓ Restored!',
    busca_sem_resultado: 'No results found.',

    kpi_tt_amazon: 'TT Amazon', kpi_distancia: 'Distance', kpi_transit_rota: 'Route transit', kpi_transit: 'Transit',
    dias_saida_view_label: '🗓️ Port departure days', dias_saida_edit_label: 'Port departure days',
    dias_nao_informado: 'Not informed.',
    preco_saca_title: '💰 PRICE PER SACK',
    preco_seca_view: '🏜️ Dry season', preco_seca_edit: '🏜️ Dry season (R$)',
    preco_cheia_view: '🌊 Flood season', preco_cheia_edit: '🌊 Flood season (R$)',
    per_saca_suffix: '/sack',
    emb_mais_usadas: 'Most used vessels', emb_empty: 'No vessel registered.',
    observacoes_label: 'Notes', observacoes_hint: '(only you see this — saved to your account)',
    observacoes_ph_tpl: 'Personal notes about {nome}...',
    ta_label: 'Transit Time Amazon (days)',
    restaurar_btn: '⟲ Restore original', salvar_btn: '✓ Save',
    emb_add_btn: '+ Add vessel', avaliacao_label: 'Rating',
    emb_nome_ph: 'Vessel name', emb_tt_ph: 'days',
    emb_avaliacao_baixa_title: 'All rated vessels have a low score',
    emb_avaliacao_baixa_curto: 'Low rating',
    emb_avaliacao_baixa_aviso: 'All the rated vessels here have a low score (1-2 stars) — it may be worth reviewing operations in this municipality.',
    contato_title: 'Contact (local agent/port)',
    contato_nome_label: 'Name', contato_nome_ph: 'Contact name',
    contato_tel_label: 'Phone', contato_tel_ph: '(00) 00000-0000',
    contato_nao_informado: 'No contact registered.',
    rota_calc_btn_title: 'Distance between two municipalities',
    tile_toggle_title: 'Toggle light/dark map',
    map_toolbar_toggle_title: 'Map filters and tools',
    rota_calc_title: 'Distance between two municipalities', rota_calc_badge: 'ESTIMATE',
    rota_calc_origem_label: 'From', rota_calc_destino_label: 'To',
    rota_calc_resultado_distancia: 'Estimated distance', rota_calc_resultado_tempo: 'Estimated time',
    rota_calc_dias_tpl: '{dias} days',
    rota_calc_hint: 'Choose both municipalities to see the estimated distance and time.',
    rota_calc_nota_mesmo: 'Same municipality.',
    rota_calc_nota_mesma_calha: 'Estimate assuming a continuous route along the same corridor.',
    rota_calc_nota_via_hub: 'Estimate assuming a pass through Manaus (different corridors) — may not reflect the actual route.',
    rota_calc_limpar_btn: '✕ Clear',

    calha_word: 'Route', municipios_word: 'towns', calhas_word: 'routes', total_word: 'total',
    rota_fluvial_title: 'River route', rota_rodoviaria_title: 'Road route',
    obs_saved_dot_title: 'Has a saved note',

    seg_aduaneiro_label: 'Customs', seg_aduaneiro_curto: 'CUSTOMS',
    seg_aduaneiro_desc: 'Border town / customs axis. Focus of the Federal Revenue and Federal Police: fighting smuggling, tax evasion on goods and international drug trafficking.',
    seg_corredor_label: 'Flow Corridor', seg_corredor_curto: 'CORRIDOR',
    seg_corredor_desc: 'Town on the river flow corridor (Solimões, Amazonas, Japurá and Purus routes), used to move goods and drugs toward Manaus or the Northeast. Purely police oversight, with cargo interception.',
    seg_ponto_atencao: 'Point of attention:',

    niv_empty_html: 'No river level reading saved yet.<br>The automatic collection runs once a day — check back later.',
    niv_label: '🌊 Rio Negro level', niv_fonte_label: 'Source:', niv_unit: 'meters',
    trend_subindo: 'Rising', trend_descendo: 'Falling', trend_estavel: 'Stable',
    niv_hoje: 'today', niv_atualizado_em: 'Updated on',
    niv_mesmo_dia_ano_passado: 'Same day last year',
    niv_proximo_mesmo_dia: 'Closest to the same day, last year',
    niv_historico_title: 'History', niv_historico_range_tpl: 'last {n} readings',
    niv_feed_title: 'Level updates',
    niv_feed_estavel_tpl: 'Stable level at {v}m',
    niv_feed_trend_tpl: '{trend} {cm}cm — level at {v}m',
    niv_gauge_seca: 'Dry', niv_gauge_normal: 'Normal', niv_gauge_alerta_grupo: 'Attention/Alert/Emergency',
    niv_gauge_note: 'The flood side uses the official Manaus Civil Defense/SGB stages (attention 27.00m · alert 27.50m · emergency 29.00m). There’s no official dry-season stage — the 19.00m cutoff is an informal reference, based on the historical minimum (12.70m, the worst drought in 121 years, Oct/2023).',
    regime_seca_severa: 'Severe drought', regime_seca: 'Dry', regime_normal: 'Normal',
    regime_atencao: 'Attention', regime_alerta: 'Alert (flood)', regime_emergencia: 'Emergency (flood)',
    alert_text_seca_severa: 'The river is in a severe drought range, close to the historical minimum. May affect deeper-draft vessels in shallow stretches.',
    alert_text_atencao: 'The river is at the attention stage (Manaus Civil Defense/SGB). No restriction yet, but worth watching closely.',
    alert_text_alerta: 'The river is at the alert/flood stage (Manaus Civil Defense/SGB). May affect lower areas and access to some ports/docks.',
    alert_text_emergencia: 'The river is at the emergency stage (Manaus Civil Defense/SGB) — severe flood level.',
    niv_alert_title_tpl: 'River level: {regime}',

    clima_title: 'Weather in the municipalities', clima_hub_badge: 'CAPITAL · HUB', clima_atualizado_tpl: 'updated at {hora}',
    clima_atualizar_agora: 'Refresh now', clima_fonte_nota: 'Weather-model data (Open-Meteo), not a live radar feed — sudden, highly localized heavy rain may take a few minutes to show up here. Tap ⟳ to fetch again now.',
    clima_radar_mini_title: 'Rain radar now', clima_radar_indisponivel: 'Radar unavailable right now',
    radar_btn_label: 'Radar', radar_ligar_title: 'Show live rain radar (radar/satellite) on the map', radar_desligar_title: 'Turn off rain radar',
    radar_pausar_title: 'Pause animation', radar_tocar_title: 'Play animation', radar_carregando: 'Loading radar…',
    radar_agora: 'now', radar_min_atras_tpl: '{n}min ago', radar_min_previsao_tpl: '+{n}min · forecast',
    radar_fonte_nota: 'Radar + satellite: RainViewer',
    clima_sensacao_tpl: 'feels like {v}°', clima_chuva_title: 'Rain now', clima_vento_title: 'Wind now',
    clima_erro_html: 'Could not load the weather right now. Check your connection and try again.',
    clima_tentar_de_novo: 'Try again',
    clima_desc_limpo: 'Clear sky', clima_desc_parcial: 'Partly cloudy', clima_desc_nublado: 'Cloudy',
    clima_desc_nevoa: 'Fog/mist', clima_desc_garoa: 'Drizzle', clima_desc_chuva: 'Rain',
    clima_desc_pancada: 'Rain showers', clima_desc_neve: 'Frozen precipitation', clima_desc_trovoada: 'Thunderstorm',
    clima_desc_indef: 'No data',
    clima_aqi_title_tpl: 'Air quality (European index) · PM2.5 {pm25}µg/m³ · PM10 {pm10}µg/m³',
    clima_aqi_indef: 'Air: no data',
    clima_aqi_section_title: 'Air quality',
    clima_previsao_title: 'Next days', clima_hoje: 'Today',
    aqi_bom: 'Good air', aqi_razoavel: 'Fair air', aqi_moderado: 'Moderate air',
    aqi_ruim: 'Poor air', aqi_muito_ruim: 'Very poor air', aqi_extremo: 'Extremely poor air',
    clima_ar_alert_dot_title: 'Poor air quality in some municipality',
    clima_ar_alerta_title_tpl: 'Poor air quality in {n} municipalit(ies)',
    clima_ar_alerta_mais_tpl: ' and {n} more',

    map_filter_todas: 'ALL', map_popup_inicio: 'Start', map_popup_fim: 'End',
    ver_detalhes: 'see details ›', min_abbr: 'min', max_abbr: 'max',

    dl_seg: 'M', dl_ter: 'T', dl_qua: 'W', dl_qui: 'T', dl_sex: 'F', dl_sab: 'S', dl_dom: 'S',
    dn_seg: 'Monday', dn_ter: 'Tuesday', dn_qua: 'Wednesday', dn_qui: 'Thursday',
    dn_sex: 'Friday', dn_sab: 'Saturday', dn_dom: 'Sunday'
  },

  es: {
    tab_rotas: 'Rutas', tab_info: 'Información', tab_mapa: 'Mapa', tab_noticias: 'Nivel del río', tab_clima: 'Clima',
    tab_config: 'Configuración',
    theme_btn_title: 'Cambiar tema claro/oscuro',
    logout_title: 'Salir',
    lang_btn_title: 'Cambiar idioma',
    push_btn_title_off: 'Activar notificaciones',
    push_btn_title_on: 'Notificaciones activadas (toca para desactivar)',
    push_btn_title_negado: 'Notificaciones bloqueadas en el navegador',
    push_indisponivel_msg: 'Tu navegador no soporta notificaciones push.',
    push_negado_msg: 'Las notificaciones fueron bloqueadas en la configuración del navegador. Para activarlas, permite notificaciones para este sitio en la configuración de tu navegador/dispositivo.',
    push_erro_msg: 'No pude activar las notificaciones ahora. Intenta de nuevo en unos instantes.',
    search_ph: 'Buscar municipio o código...',
    hero_title: 'Rutas fluviales del Amazonas',
    hero_sub_tpl: '{calhas} rutas · {municipios} municipios',

    login_email_label: 'Correo electrónico', login_senha_label: 'Contraseña', login_btn: 'Entrar',
    login_entering: 'Entrando...',
    login_err_credentials: 'Correo o contraseña incorrectos.',
    login_err_connection: 'Fallo de conexión. Inténtalo de nuevo.',
    login_hint_html: 'Tu cuenta la crea el administrador del sistema.<br>¿Aún no tienes acceso? Habla con quien administra el NavLog.',

    live_connecting: 'Conectando...',
    live_live_title: 'En vivo — actualizaciones del equipo en tiempo real',
    live_offline_title: 'Sin conexión en tiempo real — puede que no veas las actualizaciones del equipo ahora',
    alert_dot_title: 'Nivel del río en rango crítico',

    config_no_permission: 'No tienes permiso para ver Configuración.',
    erro_salvar_tpl: 'No se pudo guardar: {msg}',
    empresa_card_title: '🏢 Datos de la empresa',
    empresa_card_sub: 'Nombre y logo aparecen en el encabezado para todos',
    empresa_nome_label: 'Nombre de la empresa', empresa_nome_ph: 'Ej: Facil Express',
    empresa_logo_label: 'URL del logo (imagen)', empresa_logo_ph: 'https://...',
    empresa_save_btn: '✓ Guardar datos de la empresa',

    salvando: 'Guardando...', restaurando: 'Restaurando...', salvo_ok: '✓ ¡Guardado!', restaurado_ok: '✓ ¡Restaurado!',
    busca_sem_resultado: 'No se encontraron resultados.',

    kpi_tt_amazon: 'TT Amazon', kpi_distancia: 'Distancia', kpi_transit_rota: 'Tránsito de la ruta', kpi_transit: 'Tránsito',
    dias_saida_view_label: '🗓️ Días de salida del puerto', dias_saida_edit_label: 'Días de salida del puerto',
    dias_nao_informado: 'No informado.',
    preco_saca_title: '💰 PRECIO POR SACO',
    preco_seca_view: '🏜️ Sequía', preco_seca_edit: '🏜️ Sequía (R$)',
    preco_cheia_view: '🌊 Crecida', preco_cheia_edit: '🌊 Crecida (R$)',
    per_saca_suffix: '/saco',
    emb_mais_usadas: 'Embarcaciones más usadas', emb_empty: 'Ninguna embarcación registrada.',
    observacoes_label: 'Observaciones', observacoes_hint: '(solo tú lo ves — se guarda en tu cuenta)',
    observacoes_ph_tpl: 'Notas personales sobre {nome}...',
    ta_label: 'Transit Time Amazon (días)',
    restaurar_btn: '⟲ Restaurar original', salvar_btn: '✓ Guardar',
    emb_add_btn: '+ Agregar embarcación', avaliacao_label: 'Calificación',
    emb_nome_ph: 'Nombre de la embarcación', emb_tt_ph: 'días',
    emb_avaliacao_baixa_title: 'Todas las embarcaciones calificadas tienen nota baja',
    emb_avaliacao_baixa_curto: 'Calificación baja',
    emb_avaliacao_baixa_aviso: 'Todas las embarcaciones calificadas aquí tienen nota baja (1-2 estrellas) — puede valer la pena revisar la operación en este municipio.',
    contato_title: 'Contacto (agente local/puerto)',
    contato_nome_label: 'Nombre', contato_nome_ph: 'Nombre del contacto',
    contato_tel_label: 'Teléfono', contato_tel_ph: '(00) 00000-0000',
    contato_nao_informado: 'Ningún contacto registrado.',
    rota_calc_btn_title: 'Distancia entre dos municipios',
    tile_toggle_title: 'Cambiar mapa claro/oscuro',
    map_toolbar_toggle_title: 'Filtros y herramientas del mapa',
    rota_calc_title: 'Distancia entre dos municipios', rota_calc_badge: 'ESTIMACIÓN',
    rota_calc_origem_label: 'De', rota_calc_destino_label: 'Para',
    rota_calc_resultado_distancia: 'Distancia estimada', rota_calc_resultado_tempo: 'Tiempo estimado',
    rota_calc_dias_tpl: '{dias} días',
    rota_calc_hint: 'Elige los dos municipios para ver la distancia y el tiempo estimados.',
    rota_calc_nota_mesmo: 'Mismo municipio.',
    rota_calc_nota_mesma_calha: 'Estimación considerando un trayecto continuo en la misma calha.',
    rota_calc_nota_via_hub: 'Estimación considerando paso por Manaus (calhas diferentes) — puede no reflejar el trayecto real.',
    rota_calc_limpar_btn: '✕ Limpiar',

    calha_word: 'Ruta', municipios_word: 'municipios', calhas_word: 'rutas', total_word: 'total',
    rota_fluvial_title: 'Ruta fluvial', rota_rodoviaria_title: 'Ruta por carretera',
    obs_saved_dot_title: 'Tiene una observación guardada',

    seg_aduaneiro_label: 'Aduanero', seg_aduaneiro_curto: 'ADUANERO',
    seg_aduaneiro_desc: 'Municipio fronterizo / eje aduanero. Foco de la Receita Federal y la Policía Federal: combate al contrabando, evasión de mercancías y tráfico internacional de drogas.',
    seg_corredor_label: 'Corredor de Flujo', seg_corredor_curto: 'CORREDOR',
    seg_corredor_desc: 'Municipio del corredor de flujo fluvial (rutas Solimões, Amazonas, Japurá y Purus), ruta de mercancías y drogas hacia Manaus o el Nordeste. Fiscalización puramente policial, con interceptación de cargas.',
    seg_ponto_atencao: 'Punto de atención:',

    niv_empty_html: 'Aún no hay ninguna lectura del nivel del río guardada.<br>La recolección automática se ejecuta 1 vez al día — vuelve más tarde.',
    niv_label: '🌊 Nivel del Río Negro', niv_fonte_label: 'Fuente:', niv_unit: 'metros',
    trend_subindo: 'Subiendo', trend_descendo: 'Bajando', trend_estavel: 'Estable',
    niv_hoje: 'hoy', niv_atualizado_em: 'Actualizado el',
    niv_mesmo_dia_ano_passado: 'Mismo día del año pasado',
    niv_proximo_mesmo_dia: 'Cerca del mismo día, año pasado',
    niv_historico_title: 'Histórico', niv_historico_range_tpl: 'últimas {n} lecturas',
    niv_feed_title: 'Novedades del nivel',
    niv_feed_estavel_tpl: 'Nivel estable en {v}m',
    niv_feed_trend_tpl: '{trend} {cm}cm — nivel en {v}m',
    niv_gauge_seca: 'Sequía', niv_gauge_normal: 'Normal', niv_gauge_alerta_grupo: 'Atención/Alerta/Emergencia',
    niv_gauge_note: 'El lado de crecida usa las cotas oficiales de la Defensa Civil de Manaus/SGB (atención 27,00m · alerta 27,50m · emergencia 29,00m). No existe una cota oficial de sequía — el corte de 19,00m es una referencia informal, basada en el mínimo histórico (12,70m, la peor sequía en 121 años, oct/2023).',
    regime_seca_severa: 'Sequía severa', regime_seca: 'Sequía', regime_normal: 'Normal',
    regime_atencao: 'Atención', regime_alerta: 'Alerta (crecida)', regime_emergencia: 'Emergencia (crecida)',
    alert_text_seca_severa: 'El río está en un rango de sequía severa, cerca del mínimo histórico. Puede afectar el paso de embarcaciones con más calado en tramos poco profundos.',
    alert_text_atencao: 'El río está en la cota de atención (Defensa Civil de Manaus/SGB). Aún sin restricción, pero vale la pena seguir de cerca.',
    alert_text_alerta: 'El río está en la cota de alerta/inundación (Defensa Civil de Manaus/SGB). Puede afectar zonas bajas y el acceso a algunos puertos/embarcaderos.',
    alert_text_emergencia: 'El río está en la cota de emergencia (Defensa Civil de Manaus/SGB) — nivel de inundación severa.',
    niv_alert_title_tpl: 'Nivel del río en {regime}',

    clima_title: 'Clima en los municipios', clima_hub_badge: 'CAPITAL · HUB', clima_atualizado_tpl: 'actualizado a las {hora}',
    clima_atualizar_agora: 'Actualizar ahora', clima_fonte_nota: 'Dato de modelo meteorológico (Open-Meteo), no es radar en vivo — una lluvia fuerte y repentina, muy localizada, puede tardar algunos minutos en aparecer aquí. Toca ⟳ para buscar de nuevo ahora.',
    clima_radar_mini_title: 'Radar de lluvia ahora', clima_radar_indisponivel: 'Radar no disponible ahora',
    radar_btn_label: 'Radar', radar_ligar_title: 'Ver radar de lluvia en vivo (radar/satélite) sobre el mapa', radar_desligar_title: 'Apagar el radar de lluvia',
    radar_pausar_title: 'Pausar animación', radar_tocar_title: 'Reproducir animación', radar_carregando: 'Cargando radar…',
    radar_agora: 'ahora', radar_min_atras_tpl: 'hace {n}min', radar_min_previsao_tpl: '+{n}min · pronóstico',
    radar_fonte_nota: 'Radar + satélite: RainViewer',
    clima_sensacao_tpl: 'sensación {v}°', clima_chuva_title: 'Lluvia ahora', clima_vento_title: 'Viento ahora',
    clima_erro_html: 'No se pudo cargar el clima ahora. Verifique su conexión e intente de nuevo.',
    clima_tentar_de_novo: 'Intentar de nuevo',
    clima_desc_limpo: 'Cielo despejado', clima_desc_parcial: 'Parcialmente nublado', clima_desc_nublado: 'Nublado',
    clima_desc_nevoa: 'Niebla/neblina', clima_desc_garoa: 'Llovizna', clima_desc_chuva: 'Lluvia',
    clima_desc_pancada: 'Chubascos', clima_desc_neve: 'Precipitación helada', clima_desc_trovoada: 'Tormenta',
    clima_desc_indef: 'Sin datos',
    clima_aqi_title_tpl: 'Calidad del aire (índice europeo) · PM2,5 {pm25}µg/m³ · PM10 {pm10}µg/m³',
    clima_aqi_indef: 'Aire: sin datos',
    clima_aqi_section_title: 'Calidad del aire',
    clima_previsao_title: 'Próximos días', clima_hoje: 'Hoy',
    aqi_bom: 'Aire bueno', aqi_razoavel: 'Aire razonable', aqi_moderado: 'Aire moderado',
    aqi_ruim: 'Aire malo', aqi_muito_ruim: 'Aire muy malo', aqi_extremo: 'Aire extremadamente malo',
    clima_ar_alert_dot_title: 'Mala calidad del aire en algún municipio',
    clima_ar_alerta_title_tpl: 'Mala calidad del aire en {n} municipio(s)',
    clima_ar_alerta_mais_tpl: ' y {n} más',

    map_filter_todas: 'TODAS', map_popup_inicio: 'Inicio', map_popup_fim: 'Fin',
    ver_detalhes: 'ver detalles ›', min_abbr: 'mín', max_abbr: 'máx',

    dl_seg: 'L', dl_ter: 'M', dl_qua: 'X', dl_qui: 'J', dl_sex: 'V', dl_sab: 'S', dl_dom: 'D',
    dn_seg: 'Lunes', dn_ter: 'Martes', dn_qua: 'Miércoles', dn_qui: 'Jueves',
    dn_sex: 'Viernes', dn_sab: 'Sábado', dn_dom: 'Domingo'
  },

  zh: {
    tab_rotas: '航线', tab_info: '信息', tab_mapa: '地图', tab_noticias: '河水位', tab_clima: '天气',
    tab_config: '设置',
    theme_btn_title: '切换浅色/深色主题',
    logout_title: '退出登录',
    lang_btn_title: '切换语言',
    push_btn_title_off: '开启通知',
    push_btn_title_on: '通知已开启（点击关闭）',
    push_btn_title_negado: '浏览器已阻止通知',
    push_indisponivel_msg: '您的浏览器不支持推送通知。',
    push_negado_msg: '通知已在浏览器设置中被阻止。请在浏览器/设备设置中允许此网站发送通知以启用。',
    push_erro_msg: '现在无法开启通知，请稍后再试。',
    search_ph: '搜索城镇或代码...',
    hero_title: '亚马逊州河运航线',
    hero_sub_tpl: '{calhas} 条航线 · {municipios} 个城镇',

    login_email_label: '电子邮箱', login_senha_label: '密码', login_btn: '登录',
    login_entering: '登录中...',
    login_err_credentials: '邮箱或密码不正确。',
    login_err_connection: '连接失败，请重试。',
    login_hint_html: '您的账号由系统管理员创建。<br>还没有权限？请联系 NavLog 的管理员。',

    live_connecting: '连接中...',
    live_live_title: '实时 — 团队更新即时同步',
    live_offline_title: '没有实时连接 — 现在可能看不到团队的更新',
    alert_dot_title: '河水位处于关键区间',

    config_no_permission: '您没有权限查看设置。',
    erro_salvar_tpl: '保存失败：{msg}',
    empresa_card_title: '🏢 公司信息',
    empresa_card_sub: '名称和标志会显示在所有人的页头',
    empresa_nome_label: '公司名称', empresa_nome_ph: '例如：Facil Express',
    empresa_logo_label: '标志图片链接', empresa_logo_ph: 'https://...',
    empresa_save_btn: '✓ 保存公司信息',

    salvando: '保存中...', restaurando: '恢复中...', salvo_ok: '✓ 已保存！', restaurado_ok: '✓ 已恢复！',
    busca_sem_resultado: '未找到结果。',

    kpi_tt_amazon: 'TT Amazon', kpi_distancia: '距离', kpi_transit_rota: '航线时长', kpi_transit: '时长',
    dias_saida_view_label: '🗓️ 港口出发日', dias_saida_edit_label: '港口出发日',
    dias_nao_informado: '未填写。',
    preco_saca_title: '💰 每包价格',
    preco_seca_view: '🏜️ 枯水期', preco_seca_edit: '🏜️ 枯水期 (R$)',
    preco_cheia_view: '🌊 洪水期', preco_cheia_edit: '🌊 洪水期 (R$)',
    per_saca_suffix: '/包',
    emb_mais_usadas: '常用船只', emb_empty: '暂无登记的船只。',
    observacoes_label: '备注', observacoes_hint: '（仅您可见 — 保存在您的账号中）',
    observacoes_ph_tpl: '关于{nome}的个人备注...',
    ta_label: 'Transit Time Amazon（天）',
    restaurar_btn: '⟲ 恢复默认', salvar_btn: '✓ 保存',
    emb_add_btn: '+ 添加船只', avaliacao_label: '评分',
    emb_nome_ph: '船只名称', emb_tt_ph: '天',
    emb_avaliacao_baixa_title: '所有已评分的船只评分都偏低',
    emb_avaliacao_baixa_curto: '评分偏低',
    emb_avaliacao_baixa_aviso: '这里所有已评分的船只评分都偏低（1-2星）——可能值得重新评估这个市镇的运营。',
    contato_title: '联系人（当地代理/港口）',
    contato_nome_label: '姓名', contato_nome_ph: '联系人姓名',
    contato_tel_label: '电话', contato_tel_ph: '(00) 00000-0000',
    contato_nao_informado: '暂无登记的联系人。',
    rota_calc_btn_title: '两个市镇之间的距离',
    tile_toggle_title: '切换浅色/深色地图',
    map_toolbar_toggle_title: '地图筛选和工具',
    rota_calc_title: '两个市镇之间的距离', rota_calc_badge: '估算值',
    rota_calc_origem_label: '起点', rota_calc_destino_label: '终点',
    rota_calc_resultado_distancia: '预计距离', rota_calc_resultado_tempo: '预计时间',
    rota_calc_dias_tpl: '{dias} 天',
    rota_calc_hint: '选择两个市镇以查看预计距离和时间。',
    rota_calc_nota_mesmo: '同一市镇。',
    rota_calc_nota_mesma_calha: '估算基于同一航道上的连续航程。',
    rota_calc_nota_via_hub: '估算基于经玛瑙斯中转（不同航道）——可能与实际航程不符。',
    rota_calc_limpar_btn: '✕ 清除',

    calha_word: '航线', municipios_word: '个城镇', calhas_word: '条航线', total_word: '总计',
    rota_fluvial_title: '河运航线', rota_rodoviaria_title: '公路航线',
    obs_saved_dot_title: '已有保存的备注',

    seg_aduaneiro_label: '海关', seg_aduaneiro_curto: '海关',
    seg_aduaneiro_desc: '边境城镇/海关枢纽。联邦税务局和联邦警察重点关注：打击走私、货物偷逃税及国际贩毒。',
    seg_corredor_label: '物流走廊', seg_corredor_curto: '走廊',
    seg_corredor_desc: '位于河运物流走廊（索利莫伊斯河、亚马逊河、雅普拉河和普鲁斯河航线）上的城镇，是货物和毒品运往马瑙斯或东北地区的通道。纯警方监管，含货物拦截。',
    seg_ponto_atencao: '注意事项：',

    niv_empty_html: '目前还没有保存的河水位读数。<br>自动采集每天运行一次 — 请稍后再查看。',
    niv_label: '🌊 黑河水位', niv_fonte_label: '来源：', niv_unit: '米',
    trend_subindo: '上涨', trend_descendo: '下降', trend_estavel: '稳定',
    niv_hoje: '今天', niv_atualizado_em: '更新于',
    niv_mesmo_dia_ano_passado: '去年同一天',
    niv_proximo_mesmo_dia: '去年最接近同一天',
    niv_historico_title: '历史记录', niv_historico_range_tpl: '最近 {n} 次读数',
    niv_feed_title: '水位动态',
    niv_feed_estavel_tpl: '水位稳定在 {v}m',
    niv_feed_trend_tpl: '{trend} {cm}厘米 — 水位 {v}m',
    niv_gauge_seca: '枯水', niv_gauge_normal: '正常', niv_gauge_alerta_grupo: '注意/警戒/紧急',
    niv_gauge_note: '洪水一侧采用马瑙斯民防局/SGB官方水位标准（注意 27.00m · 警戒 27.50m · 紧急 29.00m）。没有官方的枯水水位标准 — 19.00m 的分界是非正式参考，基于历史最低水位（12.70m，2023年10月，121年来最严重的枯水）。',
    regime_seca_severa: '严重枯水', regime_seca: '枯水', regime_normal: '正常',
    regime_atencao: '注意', regime_alerta: '警戒（洪水）', regime_emergencia: '紧急（洪水）',
    alert_text_seca_severa: '河流处于严重枯水区间，接近历史最低水位。可能影响吃水较深的船只通过浅滩路段。',
    alert_text_atencao: '河流处于注意水位（马瑙斯民防局/SGB）。目前尚无限制，但值得密切关注。',
    alert_text_alerta: '河流处于警戒/洪水水位（马瑙斯民防局/SGB）。可能影响低洼地区及部分港口/码头的通行。',
    alert_text_emergencia: '河流处于紧急水位（马瑙斯民防局/SGB）— 严重洪水水平。',
    niv_alert_title_tpl: '河水位：{regime}',

    clima_title: '各市镇天气', clima_hub_badge: '首府 · 枢纽', clima_atualizado_tpl: '{hora} 更新',
    clima_atualizar_agora: '立即刷新', clima_fonte_nota: '数据来自天气模型（Open-Meteo），不是实时雷达——非常局地的突发强降雨可能需要几分钟才会显示。点击 ⟳ 立即重新获取。',
    clima_radar_mini_title: '当前降雨雷达', clima_radar_indisponivel: '雷达暂时不可用',
    radar_btn_label: '雷达', radar_ligar_title: '在地图上显示实时降雨雷达（雷达/卫星）', radar_desligar_title: '关闭降雨雷达',
    radar_pausar_title: '暂停动画', radar_tocar_title: '播放动画', radar_carregando: '正在加载雷达…',
    radar_agora: '现在', radar_min_atras_tpl: '{n}分钟前', radar_min_previsao_tpl: '+{n}分钟·预测',
    radar_fonte_nota: '雷达+卫星数据来自 RainViewer',
    clima_sensacao_tpl: '体感 {v}°', clima_chuva_title: '当前降雨', clima_vento_title: '当前风速',
    clima_erro_html: '暂时无法加载天气数据。请检查网络连接后重试。',
    clima_tentar_de_novo: '重试',
    clima_desc_limpo: '晴朗', clima_desc_parcial: '局部多云', clima_desc_nublado: '多云',
    clima_desc_nevoa: '雾', clima_desc_garoa: '毛毛雨', clima_desc_chuva: '雨',
    clima_desc_pancada: '阵雨', clima_desc_neve: '冰冻降水', clima_desc_trovoada: '雷暴',
    clima_desc_indef: '无数据',
    clima_aqi_title_tpl: '空气质量（欧洲指数）· PM2.5 {pm25}µg/m³ · PM10 {pm10}µg/m³',
    clima_aqi_indef: '空气：无数据',
    clima_aqi_section_title: '空气质量',
    clima_previsao_title: '未来几天', clima_hoje: '今天',
    aqi_bom: '空气优', aqi_razoavel: '空气良', aqi_moderado: '空气中等',
    aqi_ruim: '空气差', aqi_muito_ruim: '空气很差', aqi_extremo: '空气极差',
    clima_ar_alert_dot_title: '部分市镇空气质量差',
    clima_ar_alerta_title_tpl: '{n} 个市镇空气质量差',
    clima_ar_alerta_mais_tpl: '，另有 {n} 个',

    map_filter_todas: '全部', map_popup_inicio: '起点', map_popup_fim: '终点',
    ver_detalhes: '查看详情 ›', min_abbr: '最低', max_abbr: '最高',

    dl_seg: '一', dl_ter: '二', dl_qua: '三', dl_qui: '四', dl_sex: '五', dl_sab: '六', dl_dom: '日',
    dn_seg: '星期一', dn_ter: '星期二', dn_qua: '星期三', dn_qui: '星期四',
    dn_sex: '星期五', dn_sab: '星期六', dn_dom: '星期日'
  }
};

/* Devolve o texto no idioma atual; se a chave não existir nesse idioma
   (tradução esquecida), cai pro português em vez de mostrar em branco. */
function t(key) {
  var dict = I18N[LANG] || I18N.pt;
  if (dict[key] !== undefined) return dict[key];
  return I18N.pt[key] !== undefined ? I18N.pt[key] : key;
}

/* Versão com variáveis: tf('hero_sub_tpl', {calhas:10, municipios:57}) */
function tf(key, vars) {
  var s = t(key);
  vars = vars || {};
  return s.replace(/\{(\w+)\}/g, function (m, k) { return (vars[k] !== undefined) ? vars[k] : m; });
}

function idiomaSalvo() {
  try {
    var l = localStorage.getItem(LANG_STORAGE_KEY);
    if (l && LANGS.indexOf(l) !== -1) return l;
  } catch (e) { /* modo privado etc. */ }
  return 'pt';
}

/* Aplica o idioma no texto ESTÁTICO do HTML (via atributos data-i18n*) e
   guarda a preferência. Não mexe no conteúdo gerado dinamicamente pelas
   abas — quem chama isso e precisa atualizar esse conteúdo também (o app
   principal) faz isso à parte, chamando aplicarIdioma() (em app.js). */
function setIdiomaEstatico(lang) {
  LANG = (LANGS.indexOf(lang) !== -1) ? lang : 'pt';
  try { localStorage.setItem(LANG_STORAGE_KEY, LANG); } catch (e) { /* ignora: modo privado etc. */ }
  document.documentElement.setAttribute('lang', LANG === 'pt' ? 'pt-BR' : LANG);

  document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  document.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });

  var btn = document.getElementById('lang-btn');
  if (btn) btn.textContent = (LANG_META[LANG] && LANG_META[LANG].label) || 'PT';
}

/* ── Menu suspenso do botão de idioma (cabeçalho + tela de login) ──
   Clicar no botão abre uma listinha com os 4 idiomas pra escolher direto,
   em vez de ficar clicando várias vezes pra ciclar até o que quer. */
function idiomaMenuHTML() {
  return LANGS.map(function (l) {
    return '<button type="button" class="lang-opt' + (l === LANG ? ' on' : '') + '" onclick="selecionarIdioma(\'' + l + '\')">' + LANG_META[l].nome + '</button>';
  }).join('');
}
function toggleLangMenu(e) {
  if (e) e.stopPropagation();
  var menu = document.getElementById('lang-menu'); if (!menu) return;
  var vaiAbrir = !menu.classList.contains('on');
  if (vaiAbrir) { menu.innerHTML = idiomaMenuHTML(); menu.classList.add('on'); }
  else menu.classList.remove('on');
}
function fecharLangMenu() {
  var menu = document.getElementById('lang-menu');
  if (menu) menu.classList.remove('on');
}
/* Escolha feita no menu: em index.html isso também reconstrói o conteúdo
   dinâmico das abas (aplicarIdioma(), definida em app.js); em login.html,
   que não carrega app.js, só troca o texto estático mesmo. */
function selecionarIdioma(lang) {
  fecharLangMenu();
  if (typeof aplicarIdioma === 'function') aplicarIdioma(lang);
  else setIdiomaEstatico(lang);
}
document.addEventListener('click', function (e) {
  var menu = document.getElementById('lang-menu');
  if (!menu || !menu.classList.contains('on')) return;
  if (menu.contains(e.target) || e.target.id === 'lang-btn') return;
  fecharLangMenu();
});

/* ── ripple: ondinha saindo do ponto do clique, nos botões de
   tema/idioma/filtro/zoom (delegado — funciona também nos que são criados
   dinamicamente depois, tipo os filtros do mapa). Fica aqui (i18n.js) por
   ser o arquivo comum entre index.html e login.html. ── */
document.addEventListener('click', function (e) {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  var el = e.target.closest('.theme-btn, .lang-opt, .mfbtn, .mcb, .logout-btn');
  if (!el) return;
  var rect = el.getBoundingClientRect();
  var x = e.clientX - rect.left, y = e.clientY - rect.top;
  var tam = Math.max(rect.width, rect.height) * 1.8;
  var onda = document.createElement('span');
  onda.className = 'ripple-el';
  onda.style.width = onda.style.height = tam + 'px';
  onda.style.left = (x - tam / 2) + 'px';
  onda.style.top = (y - tam / 2) + 'px';
  el.appendChild(onda);
  onda.addEventListener('animationend', function () { if (onda.parentNode) onda.remove(); });
  setTimeout(function () { if (onda.parentNode) onda.remove(); }, 700); // segurança, caso animationend não dispare
});
