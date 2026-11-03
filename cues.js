/* About eight minutes at a clear teaching pace. Chinese is reference text,
   not a second spoken track. Every entry matches one physical PPT page. */
(() => {
  const cues = [
    [
      ['Hello, everyone. I’m Zhilan, your AI teacher for academic English.', '同学们好，我是知兰，你们的学术英语智能教师。'],
      ['Today we’ll learn how to write results, discussion, and conclusions. You can ask me a question at any time.', '今天我们学习如何撰写论文的结果、讨论与结论。你可以随时向我提问。']
    ],
    [['Today, we’ll distinguish these three sections and practice logical development, sentence variety, and coherence in writing.', '今天我们要区分这三个部分，并练习如何做到逻辑清晰、句式多样、衔接连贯。']],
    [['Let’s begin with results. Tell readers what your study found. Present the facts, figures, and patterns clearly, with analysis grounded in the data.', '我们先看结果部分。告诉读者你的研究发现了什么，清楚呈现事实、数据与规律，并以数据为依据进行分析。']],
    [['When writing your results, combine accurate reporting with clear organization. Help readers understand the findings without exaggerating their importance.', '撰写结果时，要兼顾报告准确与组织清晰。帮助读者理解研究发现，但不要夸大其重要性。']],
    [
      ['Look at this chloride permeability example. Some tests stopped because of excessive heat. Those values were extrapolated, not fully measured.', '来看这个氯离子渗透性案例。部分测试因过热而中止，相应数值来自外推，而非完整测量。'],
      ['A good report makes that distinction explicit.', '规范的报告应明确说明这种区别。']
    ],
    [['Useful openings include “Figure three shows” and “Table five presents.” Then identify the important pattern instead of repeating every number.', '常用开头包括“图三显示”和“表五呈现”。随后指出重要规律，而不是重复每一个数值。']],
    [['Think of writing as painting. Your words and sentence structures should work together to communicate a clear idea.', '可以把写作想象成绘画。你选择的词语与句子结构应相互配合，清楚地传达一个意思。']],
    [['Here, “unrelenting” means continuing without becoming weaker. Its tone depends on context: persistent effort differs from harsh, unrelenting criticism.', '这里的 unrelenting 指持续而不减弱。它的语气取决于语境：不懈努力不同于严厉且不休止的批评。']],
    [['For the nasal consonants, first identify what each axis measures. Then describe the pattern and support your description with data.', '在鼻辅音练习中，先明确每个坐标轴测量什么，再描述变化规律，并用数据支持你的描述。']],
    [['Logical development can lead from background to a hypothesis, or from a general statement to examples. Keep every sentence focused.', '逻辑展开可以由背景引出假设，也可以从概括性陈述转向具体例子。每个句子都应围绕重点。']],
    [['Which details belong in this paragraph? Sports and travel distract from the topic. Keep only information that supports your main point.', '哪些细节应该留在这个段落中？运动和旅行偏离了主题。只保留能够支持主旨的信息。']],
    [['The revision removes distractions and connects the topic, supporting details, and conclusion. This improves organization, but factual claims still need evidence.', '修改稿删去干扰信息，连接主题、支撑细节与结尾。这改善了组织结构，但事实性论断仍需要证据。']],
    [['Before adding transitions, identify the logical connections. The example’s gender claims also need evidence; smoother language alone cannot make them reliable.', '添加过渡词之前，先明确逻辑联系。例子中的性别论断同样需要证据；仅让语言更流畅，并不能使论断变得可靠。']],
    [['“Since” introduces a reason. “Consequently” signals a result. “However” and “nevertheless” mark contrast. Choose transitions that express the actual relationship.', 'Since 引出原因，consequently 表示结果，however 和 nevertheless 表示转折。过渡词必须表达真实的逻辑关系。']],
    [
      ['Discussion asks what the findings mean. Explain relationships, compare previous research, acknowledge limitations, and identify implications.', '讨论部分追问研究发现意味着什么。它解释关系、比较前人研究、承认局限，并指出启示。'],
      ['It is more than a second list of results.', '它不是再列一遍研究结果。']
    ],
    [['In the language learning example, examine social context, cognitive style, and personality. Compare each finding with earlier research.', '在语言学习案例中，考察社会背景、认知风格与个性，并将每项发现与已有研究比较。']],
    [['Learning conditions and strategies provide further themes. However, an association with achievement does not by itself prove that a strategy causes improvement.', '学习条件与学习策略构成进一步的讨论主题。然而，与成绩有关联，本身并不能证明某种策略会导致进步。']],
    [['Here, the study shows correlations and does not fully measure English proficiency. Explain these limitations before stating what the findings can contribute.', '这里的研究揭示了相关性，但没有全面测量英语能力。在说明研究发现的贡献之前，要先解释这些局限。']],
    [['Follow a clear sequence in your discussion: interpret each finding, connect it to literature, and consider limitations alongside contributions.', '你的讨论应遵循清晰的顺序：解释各项发现，联系已有文献，并把局限与贡献结合起来考虑。']],
    [['Avoid vague variable names, missing literature connections, and unmentioned limitations. Remove unnecessary words so the central argument remains clear.', '避免变量名称含糊、缺少文献联系，以及不提研究局限。删去不必要的词语，让核心论证保持清晰。']],
    [['Compare findings with the original hypothesis. Explain agreement or disagreement. An unexpected result is something to investigate, not something to hide.', '将发现与原假设比较，并解释一致或不一致之处。意外结果值得研究，而不应被隐藏。']],
    [['When proposing an explanation, “One reason could be” signals uncertainty. Distinguish a plausible explanation from a cause that has actually been demonstrated.', '提出解释时，“一个可能的原因是”表达了不确定性。要区分合理的解释与已经得到证实的原因。']],
    [['Choose inference verbs carefully. “Suggest” is more cautious than “confirm.” The strength of your language should match the strength of your evidence.', '谨慎选择推论动词。Suggest 比 confirm 更为审慎。措辞的强度应与证据的强度相匹配。']],
    [['State limitations specifically: a small sample, restricted groups, or simplifying assumptions. Then explain how those limitations affect interpretation or generalization.', '具体说明局限，例如样本较小、样本群体受限，或采用简化假设。随后解释这些局限如何影响结果解释或推广。']],
    [['Future work should address an identified gap. Specify a different sample, method, or condition instead of merely saying that more research is needed.', '未来研究应针对已发现的不足。明确提出不同的样本、方法或条件，而不只是说“还需要更多研究”。']],
    [['Check four things in your discussion: interpretation, literature connections, limitations, and implications. Does each point connect to the evidence?', '检查讨论中的四个要素：解释、文献联系、局限与启示。每一点都与证据对应起来了吗？']],
    [
      ['Now consider the concrete example. Connect permeability changes to drying conditions and silica fume, then refer readers to relevant figures.', '现在来看混凝土案例。把渗透性变化与干燥条件、硅灰联系起来，再引导读者查看相关图形。'],
      ['Keep the comparison within the mixtures actually tested.', '比较范围应限定在实际测试的混合料之内。']
    ],
    [['At eleven degrees Celsius, the reported response differs across mixture compositions. Preserve temperature and mixture conditions when paraphrasing this finding.', '在十一摄氏度下，文中报告的反应因混合料组成而异。转述该发现时，要保留温度与混合料条件。']],
    [['Sentence variety can reduce repetition. Combine the three statements into “a lengthy, detailed study.” Keep the meaning while making the expression more economical.', '句式变化可以减少重复。把三个陈述合并为“一项历时较长且详尽的研究”，在保留原意的同时让表达更简洁。']],
    [['Vary sentence openings with an adverb, a prepositional phrase, or a clause. Choose the opening that emphasizes the most useful information.', '可以用副词、介词短语或从句改变句子开头。选择能够突出最有用信息的开头方式。']],
    [['Read this paragraph about computerized systems. Its nine sentences repeat similar patterns. Before revising, examine their length, structure, and openings together.', '读一读这个关于计算机系统的段落。九个句子重复使用了相似的句式。修改前，要一起检查它们的长度、结构和开头。']],
    [['The table makes the repetition visible: mostly medium-length simple sentences with noun phrase openings. Repetition can make relationships harder to follow.', '表格直观显示了重复：多数是中等长度的简单句，并以名词短语开头。重复可能使句间关系更难把握。']],
    [['The revision combines nine sentences into four and varies their openings. Related details are grouped, while contrasts and qualifications become easier to follow.', '修改稿把九个句子合为四个，并改变开头。相关细节被归在一起，转折和限定关系也更加清楚。']],
    [['For practice, vary length, structure, and openings. Do not make every sentence longer. Variety should improve clarity, not create complexity for its own sake.', '练习时，可以改变句长、结构和开头。不要把每句都拉长。多样性应提高清晰度，而不是为复杂而复杂。']],
    [['The environment paragraph moves from a definition to a town-and-countryside contrast. Notice how sentence length supports the change in focus.', '环境段落从定义转向城市与乡村的对比。注意句子长度如何配合重点的变化。']],
    [['When reading the translation paragraph, trace its purpose, error types, and possible causes. Check logic and evidence alongside sentence style.', '阅读翻译段落时，梳理它的研究目的、错误类型与可能原因，同时检查逻辑、证据与句式风格。']],
    [['In these rewriting exercises, combine repetitive statements and clarify connections. Check scientific accuracy as well as grammar before accepting a smoother version.', '在这些改写练习中，合并重复陈述并明确联系。接受更流畅的版本之前，不仅要检查语法，也要核查科学准确性。']],
    [['A conclusion summarizes the main findings, answers the research question, and may recommend further work. Some papers include it within the discussion.', '结论概括主要发现、回答研究问题，也可以建议后续研究。有些论文将结论包含在讨论部分之中。']],
    [['Ask whether the conclusion fits the research design and evidence. Consider its relationship to other studies and any justified practical applications.', '要问结论是否符合研究设计与证据，并考虑它与其他研究的关系，以及有依据的实际应用。']],
    [['Conclusions must follow from the data and answer the original question. Avoid introducing unsupported claims or copying large parts of the introduction.', '结论必须由数据推出，并回答原始问题。避免引入没有依据的论断，也不要大段照搬引言。']],
    [['These examples summarize language learning and transport studies. Keep their conclusions tied to the studied population, system, and observation period.', '这些案例概括语言学习和交通研究。结论应与所研究的人群、系统及观察时段保持对应。']],
    [
      ['Results report what was observed. Conclusions explain the overall answer supported by those observations.', '结果报告观察到了什么；结论说明这些观察支持怎样的总体回答。'],
      ['You can ask me to illustrate this distinction.', '你可以让我举例说明这一区别。']
    ],
    [['This thematic progression example analyzes two essays. Its limited sample reminds us not to generalize a local pattern to every text or genre.', '这个主位推进案例分析了两篇文章。有限的样本提醒我们，不要把局部规律推广到所有文本或体裁。']],
    [['Phrases such as “On the basis of” and “In conclusion” introduce a conclusion. The evidence that follows matters more than the formula.', '“在……基础上”和“总之”等表达可以引出结论，但随后所陈述的证据，比固定句式更重要。']],
    [
      ['The final concrete example keeps material and temperature conditions in its conclusion. It also qualifies expectations under natural exposure.', '最后的混凝土案例在结论中保留了材料与温度条件，也对自然暴露环境下的预期作了限定。'],
      ['Separate tested findings from predictions about future performance.', '要区分经过测试的发现与对未来表现的预测。']
    ],
    [['Remember: report findings accurately, discuss their meaning and limits, and conclude with a supported answer. Explain unexpected findings, too.', '请记住：准确报告发现，讨论其意义与局限，并给出有依据的结论。意外的结果也要解释。']],
    [['That’s our lesson for today. Connect evidence, interpretation, and conclusion in your writing. If you have a question, I’m ready to help.', '今天的课就到这里。在写作中，要把证据、解释与结论联系起来。如果你有问题，可以继续向我提问。']]
  ];
  if (cues.length !== window.AECOURSE.slides.length) throw new Error('Lecture/page count mismatch');
  window.AECOURSE.slides.forEach((slide, i) => {
    slide.cues = cues[i].map(([en, zh]) => ({en, zh}));
    slide.en = slide.cues.map(cue => cue.en).join(' ');
    slide.zh = slide.cues.map(cue => cue.zh).join(' ');
    slide.wordCount = slide.en.match(/\S+/g).length;
    slide.estimatedSeconds = slide.wordCount / window.AECOURSE.wordsPerMinute * 60 + slide.cues.length * 0.25;
  });
  window.AECOURSE.wordCount = window.AECOURSE.slides.reduce((n, slide) => n + slide.wordCount, 0);
  window.AECOURSE.estimatedSeconds = window.AECOURSE.slides.reduce((n, slide) => n + slide.estimatedSeconds, 0);
})();
