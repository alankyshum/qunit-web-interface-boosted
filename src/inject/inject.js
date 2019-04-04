checkInit = setInterval(() => {
  const originalSearchField = document.getElementById('qunit-modulefilter');
  if (!originalSearchField) return;

  clearInterval(checkInit);
  // originalSearchField.style.display = 'none';

  testRun();
}, 100);

function testRun() {
  const mainWrapperID = '__qunit-boosted';
  const mainWrapperIDroot = '__qunit-boosted-root';

  // clean up
  removeNode(document.getElementById(mainWrapperID));
  removeNode(document.getElementById(`${mainWrapperID}__toggler-wrapper`));

  // init
  const mainWrapperRoot = document.createElement('div');
  mainWrapperRoot.id = mainWrapperIDroot;

  const mainWrapperChecker = document.createElement('input');
  mainWrapperChecker.id = `${mainWrapperID}__wrapper-checker`;
  mainWrapperChecker.hidden = true;
  mainWrapperChecker.type = 'checkbox';
  mainWrapperRoot.appendChild(mainWrapperChecker);

  const mainWrapperToggler = document.createElement('label');
  mainWrapperToggler.setAttribute('for', mainWrapperChecker.id);
  mainWrapperToggler.textContent = 'Regex Filter Qunit tests';
  mainWrapperToggler.id = `${mainWrapperID}__wrapper-toggler`;
  mainWrapperRoot.appendChild(mainWrapperToggler)

  const mainWrapper = document.createElement('div');
  mainWrapper.id = mainWrapperID;
  mainWrapperRoot.appendChild(mainWrapper);

  const mainWrapperInjectTarget = document.getElementById('qunit-testrunner-toolbar');
  mainWrapperInjectTarget.appendChild(mainWrapperRoot);

  const modelConfig = {
    debounce: 200,
    timer: null,
    testsList: getFullList(),
    selectedTestIDs: location.search.match(/moduleid=\w+/ig).map(moduleSearch => moduleSearch.split('=')[1])
  };

  const DOMelements = injectComponents(mainWrapper, modelConfig);
  const { searchInput, searchOptions, selectedTestWrapper, matchedTestWrapper, applyButton } = DOMelements;
  injectSelectedTests(selectedTestWrapper, modelConfig);

  // listeners
  applyButton.addEventListener('click', () => {
		const selectedTestIDs = modelConfig.selectedTestIDs;
		const selectedTestCount = selectedTestIDs.length;
    const moduleSearchParam = selectedTestIDs.reduce((fullString, id, index) => fullString + `moduleId=${id}${index === selectedTestCount - 1 ? '' : '&'}`, '');

    location.search = `?${moduleSearchParam}`
  });

  searchInput.addEventListener('keyup', () => onTriggerSearch(DOMelements, modelConfig));

  Object.values(searchOptions).forEach(({ getOnClickTarget }) => {
    getOnClickTarget().addEventListener('click', () => onTriggerSearch(DOMelements, modelConfig));
	});

	selectedTestWrapper.addEventListener('change', () => {
		const selectedTests = selectedTestWrapper.selectedOptions;
		modelConfig.selectedTestIDs = [];
		Object.values(selectedTests).forEach(selectedTest => {
			modelConfig.selectedTestIDs.push(selectedTest.value);
		});
	});

  matchedTestWrapper.addEventListener('change', () => {
    const selectedMatchedTests = matchedTestWrapper.selectedOptions;
    const selectTestVirtualDOM = document.createDocumentFragment();
    const uniqueTestIDset = [];

    Object.values(selectedTestWrapper)
      .concat(Object.values(selectedMatchedTests))
      .map(selectedTest => {
        if (uniqueTestIDset.includes(selectedTest.value)) return;

        selectedTest.selected = true;
        selectTestVirtualDOM.append(selectedTest);
        uniqueTestIDset.push(selectedTest.value);
        modelConfig.selectedTestIDs.push(selectedTest.value);
      });

    selectedTestWrapper.innerHTML = '';
    selectedTestWrapper.appendChild(selectTestVirtualDOM);
  });
}

function onTriggerSearch(DOMelements, modelConfig) {
  const { searchInput, matchedTestWrapper, searchOptions } = DOMelements;
  const { debounce, testsList, selectedTestIDs } = modelConfig;

  const searchString = searchInput.value;

  clearTimeout(modelConfig.timer);

  modelConfig.timer = setTimeout(() => {
    const searchRegex = getSearchRegex(searchString, searchOptions);
    onSearchNewKeyword(testsList, searchRegex, matchedTestWrapper, selectedTestIDs);
  }, debounce);
};

function removeNode(mainWrapper) {
  mainWrapper && mainWrapper.parentElement.removeChild(mainWrapper);
}

function onSearchNewKeyword(testsList, searchRegex, matchedTestWrapper, selectedTestIDs) {
  const searchResults = searchText(testsList, searchRegex);
  matchedTestWrapper.innerHTML = '';

  const resultWrapper = document.createDocumentFragment();

  searchResults.forEach(searchResult => {
    const option = document.createElement('option');
    option.innerText = searchResult.text;
    option.value = searchResult.testID;

    if (selectedTestIDs.includes(searchResult.testID)) {
      option.selected = true;
    }

    resultWrapper.appendChild(option);
  });

  matchedTestWrapper.appendChild(resultWrapper);
}

function getSearchRegex(wordPattern, searchOptions) {
  const testTypesFiltersString = Object.values(searchOptions)
    .filter(({ getValue, testPrefix }) => getValue())
    .map(({ testPrefix }) => testPrefix).join('|');

  const prefixRegex = testTypesFiltersString.length > 0 ? `(${testTypesFiltersString})` : '';

  return new RegExp(`^${prefixRegex}.*${wordPattern}`, 'i');
}

function injectComponents(wrapper) {
  const idPrefix = wrapper.id;

  const searchOptions = {
    eslint: { text: 'ESLint', testPrefix: 'ESLINT' },
    unit: { text: 'Unit tests', testPrefix: 'Unit' },
    integration: { text: 'Integration tests', testPrefix: 'Integration' },
    acceptance: { text: 'Acceptance Tests', testPrefix: 'Acceptance' },
    other: { text: 'Other', testPrefix: '\w' },
  };

  const searchOptionsDOMHTML = Object.entries(searchOptions).map(([ domID, { text, testPrefix } ]) => {
    const optionInputID = `${idPrefix}__options-${domID}`;

    searchOptions[domID].getValue = () => document.getElementById(optionInputID).checked;
    searchOptions[domID].getOnClickTarget = () => document.getElementById(`${optionInputID}-control`);
    searchOptions[domID].testPrefix = testPrefix;

    return `
      <input id="${optionInputID}" type='checkbox' hidden>
      <label for="${optionInputID}" id="${optionInputID}-control" class="${idPrefix}__options-wrapper">
        <span>${text}</span>
      </label>
    `;
  });

  const html = `
    <div id="${idPrefix}__options">
      <span>Tests types:</span>
      ${searchOptionsDOMHTML.join(' ')}
    </div>

    <div id="${idPrefix}__control">
      <button id="${idPrefix}__apply">Apply</button>
    </div>

    <div id="${idPrefix}__search-wrapper">
      <input id="${idPrefix}__search-field" placeholder="Regex search for tests"/>
      <select id="${idPrefix}__search-results" multiple></select>
    </div>

    <select id="${idPrefix}__selected-results" multiple></select>
  `;

  wrapper.innerHTML = html;

  return {
    searchInput: document.getElementById(`${idPrefix}__search-field`),
    matchedTestWrapper: document.getElementById(`${idPrefix}__search-results`),
    selectedTestWrapper: document.getElementById(`${idPrefix}__selected-results`),
    applyButton: document.getElementById(`${idPrefix}__apply`),
    searchOptions
  };
}

function injectSelectedTests(selectedTestWrapper, modelConfig) {
  const { testsList, selectedTestIDs } = modelConfig;
  const selectedTestVirtualDOM = document.createDocumentFragment();

  getTestsByIDs(testsList, selectedTestIDs).forEach(({ text, testID }) => {
    const selectedTestOption = document.createElement('option');
    selectedTestOption.selected = true;
    selectedTestOption.value = testID;
    selectedTestOption.innerText = text;
    selectedTestVirtualDOM.appendChild(selectedTestOption);
  });

  selectedTestWrapper.appendChild(selectedTestVirtualDOM);
}

function searchText(testsList, testReg) {
  return testsList.filter(test => {
    return testReg.test(test.text);
  });
}

function getTestsByIDs(testsList, testIDs) {
  return testsList.filter(test => {
    return testIDs.includes(test.testID);
  });
}

function getFullList() {
  return Object.values(document.querySelectorAll('#qunit-modulefilter-dropdown-list li'))
    .map(testElement => ({
      text: testElement.textContent,
      testID: testElement.querySelector('input').value
    }));
}