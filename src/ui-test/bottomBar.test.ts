/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License", destination); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { BottomBarPanel, EditorView, MarkerType, OutputView, ProblemsView, TerminalView, VSBrowser } from 'vscode-extension-tester';
import * as path from 'path';
import { expect } from 'chai';

// Sample tests using the Bottom Bar, the panel that houses the terminal, output, problems, etc.
describe('Bottom Bar Example Tests', function () {
	let bottomBar: BottomBarPanel;

	before(async function () {
		// init the bottom bar page object
		bottomBar = new BottomBarPanel();

		// make sure the panel is open
		await bottomBar.toggle(true);
	});

	after(async function () {
		// make sure the panel is closed
		await bottomBar.toggle(false);
	});

	// The panel houses potentially several different views, lets test those
	// starting with the problems view
	describe('Problems View', function () {
		let view: ProblemsView;

		// wait condition for problem markers to exist within problems view
		async function problemsExist(view: ProblemsView) {
			// search for markers regardless of type until some are found
			const markers = await view.getAllVisibleMarkers(MarkerType.Any);
			return markers.length > 0;
		}

		before(async function () {
			// this operation will likely take more than 2 seconds (default mocha timeout)
			// we need to increase the timeout, unless we're using a global config file for that
			this.timeout(30000);

			// firstly, open the problems view
			view = await bottomBar.openProblemsView();

			// now we need some problems, lets open a file that contains some
			await VSBrowser.instance.openResources(path.join('src', 'ui-test', 'resources', 'problems.ts'), async () => {
				await VSBrowser.instance.driver.sleep(3_000); // give vscode workbench some more time to load properly
				// this can be used for some dymamic waiting such for example wait until editor with given title is opened and so on
			});

			// wait for the editor to parse the file and display the problem markers
			await view.getDriver().wait(async function () {
				return await problemsExist(view);
			}, 15000);
		});

		after(async function () {
			await new EditorView().closeAllEditors();
		});

		// These tests use getAllVisibleMarkers() and are unreliable and should not be included.
		//
		// now we can look at the error markers
		it('Error markers are displayed', async function () {
			// generally, there are 3 marker types (warning, error, and file - file just contains other markers though)
			// we want to see the errors
			const errors = await view.getAllVisibleMarkers(MarkerType.Error);

			// assert that there are errors (there should be about 8 in the file)
			expect(errors.length).is.greaterThan(5);
		});

		// we can make sure no warnings are present at the same time
		it('There are no warnings', async function () {
			const warnings = await view.getAllVisibleMarkers(MarkerType.Warning);
			expect(warnings).is.empty;
		});

		// there is also a file marker (out problematic file that contains the errors)
		it('There is a file marker', async function () {
			const files = await view.getAllVisibleMarkers(MarkerType.File);
			const file = files[0];

			// we can get the text of the marker
			expect(await file.getText()).contains('problems.ts');
			// and the type
			expect(await file.getType()).equals(MarkerType.File);
			// and we can collapse & expand the file marker
			await file.toggleExpand(false);
			await file.toggleExpand(true);
		});

		it('Markers are displayed', async function () {
			// Need to throttle this test in order for VS Code to load/display all of the errors
			// and warnings.
			await new Promise((res) => setTimeout(res, 3000));

			const markers = await view.getAllVisibleMarkers(MarkerType.Any);
			const badgeElement = await view.getCountBadge();
			const badgeText = await badgeElement.getText();

			// getAllVisibleMarkers() only returns the **visible** markers, so we can't rely on the count,
			// but we should be able to rely on at least one appearing.
			expect(markers.length).is.greaterThan(0);

			// Regardless of how many are visible, the first row contains the summary, and the badge
			// contains the count.
			expect(badgeText).equals('7');
		});

		// we can also define filtering for problems
		it('Filtering works', async function () {
			// set filter to something more specific
			// Workaround: calling twice to bypass some weird behaviour in some local cases
			await view.setFilter('aa');
			await view.getDriver().sleep(500);
			await view.setFilter('aa');

			// wait a bit for the filter to apply
			await view.getDriver().sleep(500);
			const errors = await view.getAllVisibleMarkers(MarkerType.Error);

			// now there should be just a single error
			expect(errors.length).equals(1);

			// clearing the filter is just as simple
			await view.clearFilter();
		});
	});

	// lets test the output view now
	describe('Output View', function () {
		let view: OutputView;

		before(async function () {
			this.timeout(30_000);
			// open the output view first
			view = await bottomBar.openOutputView();
			await view.getDriver().sleep(1_000); // give some time to render (can be done aslo dynamically using 'drivar.wait(...)')

			// select a channel that actually has some text in it
			await view.selectChannel('Main');
			await view.getDriver().sleep(1_000); // give some time to render (can be done aslo dynamically using 'drivar.wait(...)')
		});

		// check if there is text in the output
		it('Get the text', async function () {
			const text = await view.getText();
			expect(text).is.not.empty;
		});

		it('Clear the output channel', async function () {
			const delimiter = process.platform === 'win32' ? '\r\n' : '\n';
			await view.clearText();
			const text = await view.getText();

			// now the log is technically empty, it just contains a newline character
			expect(text).equals(delimiter);
		});
	});

	describe('Terminal View', function () {
		let view: TerminalView;

		before(async function () {
			view = await bottomBar.openTerminalView();
		});

		it('Execute a command', async function () {
			const delimiter = process.platform === 'win32' ? '\r\n' : '\n';
			await view.executeCommand('echo "hello world"', 2_000);

			// now there should be a line saying 'hello world!' in the terminal
			const text = await view.getText();
			const textFound = text.split(delimiter).some((line) => line === 'hello world');

			expect(textFound).is.true;
		});
	});
});
