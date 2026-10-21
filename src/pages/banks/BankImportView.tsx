import { Upload } from "lucide-react";
import { useApp } from "../../store/AppStore";
import { DataTools } from "../../components/DataTools";
import { SectionHead, StatCard } from "../../components/ui";

export function BankImportView() {
  const { state, catalog } = useApp();
  return (
    <>
      <SectionHead icon={<Upload />} title="导入与导出" hint="Excel / CSV / JSON 均可在本地完成，不上传服务器" />
      <div className="import-summary">
        <StatCard label="题库" value={catalog.visibleBanks.length} unit="个" hint={`${catalog.roots.length} 个一级题库`} />
        <StatCard label="题目" value={state.questions.length} unit="题" tone="jade" />
        <StatCard label="学习记录" value={state.records.length} unit="次" tone="gold" />
      </div>
      <DataTools />
      <section className="card help-card">
        <h3>导入字段说明</h3>
        <ul>
          <li>
            <b>大题库 / 小题库</b>：自动创建目录；小题库留空时题目挂在一级题库下。
          </li>
          <li>
            <b>题型</b>：单选、多选、判断、填空；也可写 single / multiple / judge / fill。
          </li>
          <li>
            <b>答案</b>：多选用逗号分隔；判断题写“对 / 错”；填空多空用英文分号分隔。
          </li>
          <li>
            <b>可接受答案</b>：按空用分号分隔，同一空多个答案用竖线分隔，例如“北京|北京市”。
          </li>
          <li>完整 JSON 备份导入时会提示覆盖当前全部数据，可用于迁移设备。</li>
        </ul>
      </section>
    </>
  );
}
