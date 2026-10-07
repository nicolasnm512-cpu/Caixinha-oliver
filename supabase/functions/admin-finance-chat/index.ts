
import "jsr:@supabase/functions-js@2.4.4/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const norm=(s:string)=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const money=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const months:any={janeiro:1,jan:1,fevereiro:2,fev:2,marco:3,mar:3,abril:4,abr:4,maio:5,mai:5,junho:6,jun:6,julho:7,jul:7,agosto:8,ago:8,setembro:9,set:9,outubro:10,out:10,novembro:11,nov:11,dezembro:12,dez:12};
const esc=(s:string)=>s.replace(/[|\\{}()[\]^$+*?.-]/g,"\\$&");

function parseMoney(text:string){
  const t=text.replace(/\s+/g," ");
  let m=t.match(/r\$\s*([\d.]+(?:,\d{1,2})?)/i);
  if(!m)m=t.match(/([\d.]+(?:,\d{1,2})?)\s*(?:reais|real)\b/i);
  if(!m)return null;
  const n=Number(m[1].replace(/\./g,"").replace(",","."));
  return Number.isFinite(n)?Math.round(n*100)/100:null;
}
function parseInteger(text:string){
  const m=text.match(/\b(\d{1,2})\b/);
  return m?Number(m[1]):null;
}
function refMonth(text:string){
  const n=norm(text); const now=new Date();
  for(const [k,v] of Object.entries(months)){
    if(new RegExp("\\b"+k+"\\b").test(n)){
      const y=(text.match(/\b(20\d{2})\b/)||[])[1]||String(now.getFullYear());
      return `${y}-${String(v).padStart(2,"0")}-01`;
    }
  }
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
}
function ptDate(d:string|null|undefined){return d?new Date(d+"T12:00:00").toLocaleDateString("pt-BR"):"—"}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Método não permitido."},405);
  try{
    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
    if(!token)return json({error:"Sessão inválida."},401);

    const url=Deno.env.get("SUPABASE_URL")!;
    const service=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const {data:u,error:ue}=await service.auth.getUser(token);
    const user=u?.user;
    if(ue||!user)return json({error:"Sessão expirada."},401);
    if(user.app_metadata?.role!=="admin")return json({error:"Acesso exclusivo da administração."},403);

    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const db=createClient(url,anon,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}});
    const body=await req.json().catch(()=>({}));

    if(body?.action==="confirm"&&body?.action_id){
      const {data,error}=await db.rpc("admin_agent_execute",{p_action_id:body.action_id});
      if(error)return json({error:error.message},400);
      return json({answer:"Atualização confirmada e registrada no histórico.",result:data});
    }
    if(body?.action==="cancel"&&body?.action_id){
      const {error}=await db.from("admin_agent_actions").update({status:"cancelled"}).eq("id",body.action_id).eq("admin_id",user.id).eq("status","preview");
      if(error)return json({error:error.message},400);
      return json({answer:"Ação cancelada. Nenhum valor foi alterado."});
    }

    const text=String(body?.message||body?.question||"").trim();
    if(!text)return json({error:"Digite o que deseja consultar ou atualizar."},400);
    const n=norm(text);

    const [{data:profiles},{data:aliases}]=await Promise.all([
      service.from("profiles").select("id,full_name,cotista_number,share_count,active").not("cotista_number","is",null),
      service.from("member_aliases").select("alias,member_id")
    ]);

    const candidates:any[]=[];
    for(const p of profiles||[]){
      const labels=[p.full_name,String(p.full_name).split(/\s+/)[0]];
      for(const al of aliases||[])if(al.member_id===p.id)labels.push(al.alias);
      for(const label of labels){
        const key=norm(label);
        if(key&&new RegExp("(^|[^a-z0-9])"+esc(key)+"([^a-z0-9]|$)").test(n)){
          candidates.push({p,label:key}); break;
        }
      }
    }
    candidates.sort((a,b)=>b.label.length-a.label.length);
    let member=candidates[0]?.p||null;
    const amount=parseMoney(text);
    const month=refMonth(text);

    if(/\b(consulta|consultar|ver|situacao|resumo|quanto|saldo)\b/.test(n)&&member){
      const year=new Date().getFullYear();
      const [{data:credit},{data:loans},{data:balances}]=await Promise.all([
        service.from("member_credit_summary").select("*").eq("member_id",member.id).maybeSingle(),
        service.from("loans").select("principal_amount,interest_amount,outstanding_amount,status,first_due_date").eq("member_id",member.id).in("status",["active","late"]).order("released_at",{ascending:false}),
        db.rpc("admin_get_annual_balances",{p_year:year})
      ]);
      const annual=(balances||[]).find((x:any)=>x.member_id===member.id);
      const paid=Number(annual?.contributions_paid||0);
      const yieldValue=Number(annual?.collective_interest_share||0);
      const debt=(loans||[]).reduce((s:number,x:any)=>s+Number(x.outstanding_amount||0),0);
      return json({answer:`${member.full_name}: cotas confirmadas ${money(paid)}; rendimento ${money(yieldValue)}; empréstimos em aberto ${money(debt)}; limite disponível ${money(Number(credit?.available_credit||0))}.`,intent:"consult_member"});
    }

    let actionType:string|null=null;
    let payload:any={};
    let preview="";
      const yieldChange=/\b(retir|retira|retirar|retirou|retire|retirada|abater|abate|abatimento|descontar|desconta|redistribuir|ratear|transferir)\b/.test(n)
      && /\b(juros|juro|rendimento|rendimentos|lucro|lucros)\b/.test(n);
    const scheduleChange=/(?:cota|cotas).*(?:a partir|passar a|reduzir|diminuir|retirar|alterar|ficar com)/
      .test(n)||/(?:reduzir|diminuir|programar|alterar).*(?:cota|cotas)/.test(n);

    if(yieldChange){
      if(!member)return json({error:"Informe o cotista que terá o rendimento abatido."},400);
      if(amount==null||amount<=0)return json({error:"Informe o valor do rendimento, como R$ 50,00."},400);

      const wantsHold=/sem redistribuir|nao redistribuir|sem dividir|nao dividir|reservar|para a reserva/.test(n);
      const wantsAll=/redistribuir|redistribui|ratear|dividir (?:entre|para) (?:todos|os demais)|para todos/.test(n)&&!wantsHold;
      const wantsTransfer=/transferir|transferencia|creditar para|para (?:a |o )?outro cotista/.test(n);
      let mode=wantsTransfer?"transfer":wantsAll?"redistribute":wantsHold?"hold":null;
      const sourcePart=mode==="transfer"&&n.lastIndexOf(" para ")>=0?n.slice(0,n.lastIndexOf(" para ")):n;
      const sourceMatch=candidates.filter(x=>sourcePart.includes(x.label)).sort((a,b)=>b.label.length-a.label.length)[0];
      if(sourceMatch)member=sourceMatch.p;
      let recipient:any=null;
      if(mode==="transfer"){
        const pos=n.lastIndexOf(" para ");
        const after=pos>=0?n.slice(pos+6):"";
        recipient=candidates.filter(x=>x.p.id!==member.id&&after.includes(x.label)).sort((a,b)=>b.label.length-a.label.length)[0]?.p||null;
        if(!recipient)return json({error:"Informe o nome do cotista que receberá o valor. Ex.: 'Retire R$ 50 de rendimento do Jamaica e transfira para Tayná'."},400);
      }
      if(!mode)return json({answer:"Você quer abater esse valor sem redistribuir, redistribuir entre os demais cotistas ou transferir para uma pessoa específica? Escreva o destino no comando.",intent:"clarify_yield_adjustment"});
      const {data:memberCredits,error:ce}=await service.from("interest_distributions")
        .select("batch_id").eq("member_id",member.id).eq("status","credited")
        .order("created_at",{ascending:false}).limit(1);
      if(ce||!memberCredits?.length)return json({error:"Não encontrei rendimento creditado para esse cotista."},400);
      const batchId=memberCredits[0].batch_id;
      const adjustmentPayload={p_batch_id:batchId,p_member_id:member.id,p_amount:amount,
        p_mode:mode,p_recipient_id:recipient?.id||null};
      const {data:plan,error:pe}=await db.rpc("admin_preview_yield_adjustment_v2",adjustmentPayload);
      if(pe)return json({error:pe.message},400);
      const summary=mode==="hold"?"O valor ficará reservado na caixinha, sem redistribuição."
        :mode==="transfer"?"O valor será creditado somente para "+recipient.full_name+"."
        :"O valor será dividido proporcionalmente entre os demais cotistas do lote.";
      actionType="adjust_yield";
      payload={batch_id:batchId,amount,mode,recipient_member_id:recipient?.id||null};
      preview="Abater "+money(amount)+" do rendimento de "+member.full_name+
        ". Saldo antes: "+money(Number(plan.before))+"; depois: "+money(Number(plan.after))+
        ". "+summary+" Confirmar?";

    }else if(scheduleChange){
      if(!member)return json({error:"Informe o cotista para programar as cotas."},400);
      const hasMonth=Object.keys(months).some(m=>n.split(/[^a-z0-9]+/).includes(m))
        ||/\b\d{4}-\d{2}-\d{2}\b/.test(n);
      if(!hasMonth)return json({error:"Informe o mês/ano de início da nova quantidade de cotas."},400);
      const qtyStr=n.match(/(?:para|ficar com|passar a)\s*(\d{1,2})(?:\s*cotas?)?\b/)
        ||n.match(/\b(\d{1,2})\s*cotas?\b/);
      const qty=qtyStr?Number(qtyStr[1]):null;
      if(qty==null||qty<1||qty>20)return json({error:"Informe a nova quantidade de cotas (de 1 a 20)."},400);
      actionType="schedule_member_shares";
      payload={share_count:qty,effective_from:month};
      preview="Programar "+qty+" cota(s) para "+member.full_name+
        " a partir de "+ptDate(month)+
        "? Créditos de rifas e juros já fechados serão preservados. Confirmar?";

    }else     if(/\b(tarifa|despesa|saida)\b/.test(n)){
      if(amount==null)return json({error:"Informe o valor da saída."},400);
      actionType="register_expense"; payload={amount,description:text};
      preview=`Registrar saída de ${money(amount)}: “${text}”?`;
    }else{
      if(!member)return json({error:"Não consegui identificar o cotista. Use o nome ou apelido cadastrado."},400);

      if(/\blimite\b/.test(n)){
        actionType="set_credit_limit";
        payload={limit:/automatic/.test(n)?"":amount};
        if(!/automatic/.test(n)&&amount==null)return json({error:"Informe o novo limite."},400);
        preview=/automatic/.test(n)?`Voltar o limite de ${member.full_name} para o cálculo automático?`:`Alterar o limite de ${member.full_name} para ${money(amount!)}?`;
    }else if(/(quantidade|numero).*cotas|cotas\s+ativas|tem\s+\d+\s+cotas/.test(n)){
        const qty=parseInteger(text);
        if(!qty)return json({error:"Informe a quantidade de cotas ativas."},400);
        actionType="set_share_count"; payload={share_count:qty};
        preview=`Alterar ${member.full_name} para ${qty} cota(s) ativa(s)?`;
      }else if(/\b(cota|mensalidade)\b/.test(n)){
        if(amount==null)return json({error:"Informe o valor da cota/mensalidade."},400);
        actionType="confirm_contribution"; payload={amount,reference_month:month,event_date:new Date().toISOString().slice(0,10)};
        preview=`Registrar ${money(amount)} de cota para ${member.full_name}, referência ${ptDate(month)}?`;
      }else if(/\bpasseio\b/.test(n)){
        if(amount==null)return json({error:"Informe o valor recebido do passeio."},400);
        actionType="confirm_trip_payment"; payload={amount,event_date:new Date().toISOString().slice(0,10)};
        preview=`Registrar ${money(amount)} de passeio para ${member.full_name}?`;
      }else if(/\brifa\b/.test(n)){
        if(amount==null)return json({error:"Informe o valor recebido da rifa."},400);
        actionType="confirm_raffle_payment"; payload={amount,event_date:new Date().toISOString().slice(0,10)};
        preview=`Registrar ${money(amount)} de rifa para ${member.full_name}?`;
      }else if(/\bjuros?\b/.test(n)){
        if(amount==null)return json({error:"Informe o valor dos juros."},400);
        if(/\b(pagou|pago|pagamento|recebido|recebeu|quitou|confirmar)\b/.test(n)){
          actionType="confirm_loan_interest_payment"; payload={amount,event_date:new Date().toISOString().slice(0,10)};
          preview=`Registrar ${money(amount)} de juros pagos por ${member.full_name}?`;
        }else{
          actionType="set_pending_loan_interest"; payload={amount};
          preview=`Ajustar os juros da próxima parcela pendente de ${member.full_name} para ${money(amount)}?`;
        }
      }
    }

    if(!actionType)return json({answer:"Posso consultar cotista e preparar ajustes de cota, juros, limite, rifa, passeio, despesas, mudança de cotas por data, abatimento e redistribuição de rendimentos. Nenhuma alteração é feita sem confirmação.",intent:"help"});

    const {data:row,error}=await db.from("admin_agent_actions").insert({
      admin_id:user.id,raw_text:text,action_type:actionType,member_id:member?.id||null,payload,status:"preview"
    }).select("id,action_type,status").single();
    if(error)return json({error:error.message},400);

    return json({
      answer:preview,
      intent:actionType,
      requires_confirmation:true,
      action_id:row.id,
      quick_replies:["Consultar cotista","Atualizar cota","Registrar juros pagos","Ajustar juros","Atualizar passeio","Atualizar rifa","Editar limite","Programar cotas de Jamaica para 1 em agosto de 2026","Abater R$ 50 de rendimento do Jamaica sem redistribuir"]
    });
  }catch(e){
    console.error(e);
    return json({error:"O Oliver ADM não conseguiu processar essa solicitação agora."},500);
  }
});
