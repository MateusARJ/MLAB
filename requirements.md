# Documentação de Requisitos: MLab

## 1. Visão Geral
Um sistema de compartilhamento de tela e áudio focado em aulas remotas. Desenvolvido com **Golang** e **Pion (WebRTC)**, o projeto utiliza uma arquitetura **SFU (Selective Forwarding Unit)** customizada. Isso garante alta performance, baixa latência e suporte para salas com 30 ou mais alunos sem sobrecarregar o processamento ou a banda de upload da máquina do professor. O sistema é multiplataforma (Windows, Linux, macOS) e o acesso é feito totalmente via navegador web.

## 2. Arquitetura do Sistema
A arquitetura base será **WebRTC + SFU**:
- **O problema do P2P puro:** Se o professor enviasse a tela para 30 alunos em P2P, a máquina dele precisaria de ~90 Mbps de upload (3 Mbps * 30), o que tornaria a transmissão inviável e pesada.
- **A Solução (SFU):** O professor envia a transmissão de áudio e vídeo (tela) **apenas uma vez** (~3 a 6 Mbps) para o servidor Backend. O servidor (SFU em Go) apenas encaminha os pacotes para todos os alunos conectados, sem precisar re-codificar (fazer transcode) do vídeo.
- **Backend:** Escrito em Go utilizando a biblioteca **Pion** para gerenciar as conexões WebRTC e atuar como o SFU. Também fornecerá uma API REST, serviço de Autenticação (JWT) e WebSockets (para o chat de texto e sinalização).
- **Frontend:** Interface em React/TypeScript, utilizando a API nativa `navigator.mediaDevices.getDisplayMedia()` para capturar a tela.

## 3. Requisitos Funcionais
- **Compartilhamento de Tela e Áudio:** O professor compartilha a sua tela com boa qualidade (alvo de 1080p, 30 FPS) e utiliza o microfone.
- **Recepção Passiva (Alunos):** Os alunos apenas recebem o áudio e vídeo da aula. Eles não transmitem vídeo nem abrem o próprio microfone.
- **Acesso via Link Único:** O aluno ingressa na transmissão através de um link/túnel único do professor (ex: `https://.../sala/professor-xyz`).
- **Chat de Texto:** O sistema deve contar com um chat de texto em tempo real (estilo Jitsi), onde todos na sala podem enviar e ler as mensagens.
- **Identificação do Aluno:** Ao entrar no link, o aluno precisa inserir seu Nome Completo e Matrícula. Isso serve para identificação na sala e no chat (sem necessariamente bloquear o acesso via API da instituição nesta primeira versão).

## 4. Requisitos Não Funcionais
- **Linguagens:** Golang (Backend) e TypeScript (Frontend).
- **Protocolos:** WebRTC (Mídia/RTP), WebSocket (Sinalização/Chat), HTTPS/WSS.
- **Banco de Dados:** PostgreSQL para armazenar os dados de acesso, históricos de sala e professores de forma local/básica.
- **Controle de Versão:** Todo o projeto deve ser versionado via Git.
- **Multiplataforma:** O backend e frontend devem ser executáveis e acessíveis em Windows, Linux e macOS.

## 5. O que NÃO fará parte do Escopo Inicial
- Integração com o banco de dados oficial da instituição (vamos usar o PostgreSQL local para a identificação básica).
- Gravação das aulas no servidor (deixado para uma versão futura).

## 6. Sugestões de Hospedagem (SFU e Tráfego)
Para transmitir para 30 alunos a 3 Mbps cada, o servidor precisará enviar cerca de 90 Mbps contínuos. Para testes ou baixo custo, seguem as recomendações:
- **Oracle Cloud (Always Free):** É a melhor recomendação para testes robustos gratuitos. Eles oferecem até 4 instâncias ARM (Ampere) com 24 GB de RAM e incríveis 10 TB de tráfego de saída (outbound) por mês sem custo. É perfeito para rodar o SFU (Go) e o Postgres.
- **DigitalOcean / Linode / Hetzner:** VPS com ótimo custo-benefício (a partir de $4 a $5 mensais). Fornecem 1 TB ou mais de tráfego de saída, sendo opções mais viáveis do que AWS/GCP para produção com vídeo pesado.
- **AWS / Google Cloud (Free Tier):** Têm instâncias gratuitas para testes, porém cobram caro pelo tráfego de saída (após os primeiros 100GB mensais), o que pode gerar surpresas se os testes de vídeo se prolongarem.
