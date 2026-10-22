"""Âncoras numéricas e tabelas fixas da Verdeluz Cosméticos Veganos (marca 100% FICTÍCIA).

Os números reais saem do gerador (`gerar_dados.gerar`); estas constantes só definem a história: sazonalidade,
queda do ROAS, alta do CAC, ruptura do sérum em MAR e ABR, mix de pagamento e Curva ABC.
"""

from __future__ import annotations

MESES = ["OUTUBRO", "NOVEMBRO", "DEZEMBRO", "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO"]

# Alvos do ano (OUT/25 a SET/26)
CAPTADA = 1_220_000
INVESTIMENTO = 262_000
QUEBRA_MEDIA = 0.065
SHARE_GOOGLE = 0.38

# Demanda sem a ruptura do sérum (NOV = Black Friday, DEZ = Natal, MAI = Dia das Mães)
SAZONALIDADE = [0.95, 1.90, 1.30, 0.75, 0.75, 1.00, 1.00, 1.35, 0.90, 0.88, 0.90, 1.00]
FATOR_RUPTURA = {"MARÇO": 0.78, "ABRIL": 0.78}

TICKET = [205, 171, 215, 200, 198, 190, 192, 210, 196, 196, 198, 200]
CONVERSAO = [1.45, 2.05, 1.60, 1.25, 1.25, 1.05, 1.00, 1.55, 1.35, 1.30, 1.35, 1.40]  # % do total de sessões

ROAS_INICIO, ROAS_FIM = 7.1, 3.35
BONUS_ROAS = {"NOVEMBRO": 0.6, "DEZEMBRO": 0.2}
CPS_META = (0.85, 1.55)
CPS_GOOGLE = (1.20, 1.90)
CONV_GOOGLE = (2.2, 1.9)  # %, início e fim
CONV_META = (0.9, 0.7)
RECORRENTES_SHARE = (0.36, 0.42)  # parcela dos pedidos do mês vinda de clientes recorrentes

QUEBRA_INICIO, QUEBRA_FIM = 0.050, 0.072
BONUS_QUEBRA = {"NOVEMBRO": 0.028, "DEZEMBRO": 0.012}
MEIOS = ["Cartão de crédito", "PIX", "Boleto"]
MIX_PAGAMENTO = [0.57, 0.38, 0.05]
PESO_QUEBRA_MEIO = [1.15, 0.55, 2.6]

CLIENTES_BASE = 10_400
PEDIDOS_BASE = 16_900
PEDIDO_MEDIO_HISTORICO = 191.8
SHARE_1_PEDIDO, SHARE_2_PEDIDOS = 0.69, 0.17
PRODUTOS_SOBRE_CAPTADA = 0.96

# (referência, nome, preço, % da receita de produtos). Os 44 itens sem percentual dividem o restante em progressão geométrica.
PRODUTOS_FIXOS = [
    ("SER001", "SÉRUM VITAMINA C 15% 30ML", 129.90, 22.0),
    ("HID001", "HIDRATANTE FACIAL GEL-CREME 50G", 89.90, 16.0),
    ("PRO001", "PROTETOR SOLAR FACIAL FPS 50", 79.90, 13.0),
    ("KIT001", "KIT ROTINA ESSENCIAL", 269.90, 8.0),
    ("KIT002", "KIT GLOW", 229.90, 6.0),
    ("SER002", "SÉRUM NIACINAMIDA 10% 30ML", 99.90, 4.6),
    ("KIT003", "KIT ANTIOXIDANTE", 249.90, 3.5),
    ("LIM001", "GEL DE LIMPEZA FACIAL 150ML", 59.90, 3.0),
    ("KIT004", "KIT PRESENTE NATAL", 299.90, 2.8),
    ("LIM002", "ÁGUA MICELAR 200ML", 54.90, 2.4),
    ("KIT005", "KIT PROTEÇÃO SOLAR", 139.90, 1.9),
    ("SER003", "SÉRUM ÁCIDO HIALURÔNICO 30ML", 109.90, 1.9),
    ("KIT006", "KIT NOITE", 219.90, 1.2),
    ("KIT007", "KIT VIAGEM", 99.90, 0.6),
]
PRODUTOS_CAUDA = [
    ("SER004", "SÉRUM RETINOL VEGETAL (BAKUCHIOL) 30ML", 119.90),
    ("SER005", "SÉRUM ÁCIDO SALICÍLICO 2% 30ML", 89.90),
    ("SER006", "SÉRUM VITAMINA C 10% PELES SENSÍVEIS 30ML", 109.90),
    ("HID002", "HIDRATANTE FACIAL NOTURNO 50G", 99.90),
    ("HID003", "HIDRATANTE FACIAL TEXTURA RICA 50G", 94.90),
    ("OLH001", "GEL HIDRATANTE PARA OS OLHOS 15G", 79.90),
    ("PRO002", "PROTETOR SOLAR TOQUE SECO FPS 60", 84.90),
    ("PRO003", "PROTETOR SOLAR COM COR TOM CLARO FPS 50", 89.90),
    ("PRO004", "PROTETOR SOLAR COM COR TOM MÉDIO FPS 50", 89.90),
    ("PRO005", "PROTETOR SOLAR COM COR TOM ESCURO FPS 50", 89.90),
    ("PRO006", "PROTETOR SOLAR CORPORAL FPS 30", 69.90),
    ("LIM003", "ESPUMA DE LIMPEZA FACIAL 150ML", 59.90),
    ("LIM004", "ÓLEO DE LIMPEZA FACIAL 100ML", 74.90),
    ("LIM005", "ESFOLIANTE FACIAL ENZIMÁTICO 60G", 69.90),
    ("LIM006", "SABONETE FACIAL EM BARRA", 34.90),
    ("MAS001", "MÁSCARA DE ARGILA VERDE 100G", 49.90),
    ("MAS002", "MÁSCARA HIDRATANTE NOTURNA 60G", 64.90),
    ("MAS003", "SHEET MASK HIDRATANTE (CAIXA COM 5)", 59.90),
    ("TON001", "TÔNICO FACIAL CALMANTE 200ML", 54.90),
    ("TON002", "TÔNICO FACIAL ESFOLIANTE AHA 200ML", 64.90),
    ("LAB001", "BÁLSAMO LABIAL VEGANO", 24.90),
    ("LAB002", "ESFOLIANTE LABIAL", 29.90),
    ("COR001", "ÓLEO CORPORAL NUTRITIVO 100ML", 69.90),
    ("COR002", "HIDRATANTE CORPORAL 250ML", 59.90),
    ("COR003", "ESFOLIANTE CORPORAL DE CAFÉ 200G", 54.90),
    ("COR004", "CREME HIDRATANTE PARA AS MÃOS 50G", 34.90),
    ("COR005", "SABONETE LÍQUIDO CORPORAL 300ML", 39.90),
    ("AMP001", "AMPOLA VITAMINA C (CAIXA COM 7)", 89.90),
    ("AMP002", "AMPOLA ÁCIDO HIALURÔNICO (CAIXA COM 7)", 89.90),
    ("MIN001", "MINI SÉRUM VITAMINA C 10ML", 39.90),
    ("MIN002", "MINI HIDRATANTE FACIAL 15G", 29.90),
    ("REF001", "REFIL HIDRATANTE FACIAL GEL-CREME 50G", 74.90),
    ("REF002", "REFIL SÉRUM VITAMINA C 30ML", 109.90),
    ("ACE001", "NECESSAIRE VERDELUZ", 49.90),
    ("ACE002", "ECOBAG VERDELUZ", 29.90),
    ("ACE003", "ESPONJA KONJAC", 24.90),
    ("ACE004", "BANDA DE CABELO PARA SKINCARE", 19.90),
    ("ACE005", "ESCOVA FACIAL DE SILICONE", 59.90),
    ("ACE006", "ROLLER FACIAL DE QUARTZO", 79.90),
    ("TON003", "SPRAY FACIAL HIDRATANTE 100ML", 44.90),
    ("SER007", "SÉRUM ANTIOXIDANTE NOITE 30ML", 129.90),
    ("HID004", "CREME PARA O PESCOÇO E COLO 50G", 99.90),
    ("MIN003", "CÁPSULAS DE SÉRUM DE VIAGEM (CAIXA COM 10)", 69.90),
    ("ACE007", "CARTÃO-PRESENTE R$ 100", 100.00),
]
ESTOQUE_BAIXO = {"SER001": 38}  # o sérum líder chega a SET/26 com pouco estoque

NOMES = [
    "Ana", "Beatriz", "Camila", "Daniela", "Eduarda", "Fernanda", "Gabriela", "Helena", "Isabela", "Juliana", "Karina", "Larissa",
    "Mariana", "Natália", "Patrícia", "Rafaela", "Sabrina", "Tatiana", "Vanessa", "Yasmin", "Aline", "Bianca", "Carolina", "Débora",
    "Elisa", "Flávia", "Giovana", "Heloísa", "Ingrid", "Joana", "Letícia", "Marcela", "Nicole", "Olívia", "Paula", "Renata",
    "Simone", "Talita", "Valéria", "Priscila", "Lucas", "Mateus", "Rafael", "Bruno", "Felipe", "Gustavo", "Henrique", "Thiago",
    "Rodrigo", "Diego", "André", "Caio", "Vinícius", "Eduardo", "Leonardo", "Pedro",
]
SOBRENOMES = [
    "Almeida", "Barbosa", "Cardoso", "Dias", "Esteves", "Ferraz", "Gomes", "Henriques", "Ibrahim", "Junqueira", "Klein", "Lopes",
    "Moura", "Nogueira", "Oliveira", "Pereira", "Queiroz", "Ribeiro", "Souza", "Teixeira", "Uchoa", "Vieira", "Xavier", "Zanetti",
    "Andrade", "Borges", "Campos", "Duarte", "Evangelista", "Fonseca", "Guimarães", "Holanda", "Inácio", "Jardim", "Lacerda", "Macedo",
    "Neves", "Ornelas", "Prado", "Rocha", "Siqueira", "Tavares", "Valente", "Werneck", "Amaral", "Bittencourt", "Castro", "Dantas",
]
