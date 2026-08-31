CREATE TYPE "public"."status_etapa" AS ENUM('aberta', 'encerrada');--> statement-breakpoint
CREATE TYPE "public"."status_sessao" AS ENUM('aguardando', 'em_andamento', 'finalizada');--> statement-breakpoint
CREATE TABLE "etapa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"posicao" integer NOT NULL,
	"titulo" text NOT NULL,
	CONSTRAINT "etapa_posicao_unica" UNIQUE NULLS NOT DISTINCT("quiz_id","posicao")
);
--> statement-breakpoint
CREATE TABLE "participante" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"entrou_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pergunta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"etapa_id" uuid NOT NULL,
	"posicao" integer NOT NULL,
	"texto" text NOT NULL,
	"alt_a" text NOT NULL,
	"alt_b" text NOT NULL,
	"alt_c" text NOT NULL,
	"alt_d" text NOT NULL,
	"correta" char(1) NOT NULL,
	CONSTRAINT "pergunta_posicao_unica" UNIQUE("etapa_id","posicao"),
	CONSTRAINT "pergunta_correta_valida" CHECK ("pergunta"."correta" IN ('A','B','C','D'))
);
--> statement-breakpoint
CREATE TABLE "quiz" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"codigo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "resposta" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"participante_id" uuid NOT NULL,
	"pergunta_id" uuid NOT NULL,
	"escolhida" char(1) NOT NULL,
	"respondida_em" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "resposta_unica_por_pergunta" UNIQUE("participante_id","pergunta_id"),
	CONSTRAINT "resposta_escolhida_valida" CHECK ("resposta"."escolhida" IN ('A','B','C','D'))
);
--> statement-breakpoint
CREATE TABLE "sessao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"status" "status_sessao" DEFAULT 'aguardando' NOT NULL,
	"etapa_atual_id" uuid,
	"etapa_status" "status_etapa",
	"iniciada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"finalizada_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "etapa" ADD CONSTRAINT "etapa_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participante" ADD CONSTRAINT "participante_sessao_id_sessao_id_fk" FOREIGN KEY ("sessao_id") REFERENCES "public"."sessao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pergunta" ADD CONSTRAINT "pergunta_etapa_id_etapa_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resposta" ADD CONSTRAINT "resposta_participante_id_participante_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participante"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resposta" ADD CONSTRAINT "resposta_pergunta_id_pergunta_id_fk" FOREIGN KEY ("pergunta_id") REFERENCES "public"."pergunta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_etapa_atual_id_etapa_id_fk" FOREIGN KEY ("etapa_atual_id") REFERENCES "public"."etapa"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "etapa_por_quiz" ON "etapa" USING btree ("quiz_id","posicao");--> statement-breakpoint
CREATE UNIQUE INDEX "participante_nome_unico" ON "participante" USING btree ("sessao_id",lower("nome"));--> statement-breakpoint
CREATE INDEX "participante_por_sessao" ON "participante" USING btree ("sessao_id","entrou_em");--> statement-breakpoint
CREATE INDEX "pergunta_por_etapa" ON "pergunta" USING btree ("etapa_id","posicao");--> statement-breakpoint
CREATE INDEX "resposta_por_pergunta" ON "resposta" USING btree ("pergunta_id","respondida_em","id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessao_ativa_unica" ON "sessao" USING btree ("quiz_id") WHERE status <> 'finalizada';