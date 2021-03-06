/* 
TabMerger as the name implies merges your tabs into one location to save
memory usage and increase your productivity.

Copyright (C) 2021  Lior Bragilevsky

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

If you have any questions, comments, or concerns you can contact the
TabMerger team at <https://lbragile.github.io/TabMerger-Extension/contact/>
*/

/**
 * @module Tab/Tab_functions
 */

/**
 * Sets the initial tabs based on Chrome's local storage upon initial render.
 * If Chrome's local storage is empty, this is set to an empty array.
 * @param {function} setTabs For re-rendering the group's tabs
 * @param {string} id Used to get the correct group tabs
 */
export function setInitTabs(setTabs, id) {
  chrome.storage.local.get("groups", (local) => {
    var groups = local.groups;
    setTabs((groups && groups[id] && groups[id].tabs) || []);
  });
}

/**
 * Adds necessary classes to the tab element once a drag event is initialized
 * @param {HTMLElement} e The tab which will be dragged within the same group or across groups
 */
export function dragStart(e) {
  var target = e.target.tagName === "DIV" ? e.target : e.target.parentNode;
  target.classList.add("dragging");
  target.closest(".group").classList.add("drag-origin");
}

/**
 * Handles the drop event once a drag is finished. Needs to re-order tabs accordingly and
 * check for sync limit violations - warning the user accordingly.
 * @param {HTMLElement} e  The dragged tab
 * @param {number} item_limit Group based sync limit
 * @param {Function} setGroups For re-rendering the groups
 *
 * @see ITEM_STORAGE_LIMIT in App.js for exact "item_limit" value
 */
export function dragEnd(e, item_limit, setGroups) {
  e.stopPropagation();
  e.target.classList.remove("dragging");

  const tab = e.target;
  var closest_group = tab.closest(".group");

  var drag_origin = document.getElementsByClassName("drag-origin")[0];
  drag_origin.classList.remove("drag-origin");

  const origin_id = drag_origin.id;

  var anchor = tab.querySelector("a");
  var tab_bytes = JSON.stringify({ title: anchor.innerText, url: anchor.href }).length;

  chrome.storage.local.get("groups", (local) => {
    var groups = local.groups;
    var itemBytesInUse = JSON.stringify(groups[closest_group.id]).length;

    // moving into same group should not increase number of bytes
    var newBytesInUse = origin_id !== closest_group.id ? itemBytesInUse + tab_bytes : itemBytesInUse;

    if (newBytesInUse < item_limit) {
      if (origin_id !== closest_group.id) {
        // remove tab from group that originated the drag
        groups[origin_id].tabs = groups[origin_id].tabs.filter((group_tab) => {
          return group_tab.url !== tab.lastChild.href;
        });
      }

      // reorder tabs based on current positions
      groups[closest_group.id].tabs = [...closest_group.querySelectorAll(".draggable")].map((x) => {
        const anchor = x.querySelector("a");
        return { title: anchor.textContent, url: anchor.href };
      });

      // update the groups
      chrome.storage.local.set({ groups }, () => {
        setGroups(JSON.stringify(groups));
      });
    } else {
      alert(`Group's syncing capacity exceeded by ${
        newBytesInUse - item_limit
      } bytes.\n\nPlease do one of the following:
          1. Create a new group and merge new tabs into it;
          2. Remove some tabs from this group;
          3. Merge less tabs into this group (each tab is ~100-300 bytes).`);
      window.location.reload();
    }
  });
}

/**
 * Removes a tab from the group and adjusts global & group counts.
 * @param {HTMLElement} e The "x" node element that user clicked on
 * @param {Array.<{title: string, url: string, id: string?}>} tabs The group's existing tabs (to find tab to remove)
 * @param {function} setTabs For re-rendering the group's tabs
 * @param {function} setTabTotal For re-rendering the total number of groups
 * @param {function} setGroups For re-rendering the overall groups
 */
export function removeTab(e, tabs, setTabs, setTabTotal, setGroups) {
  var tab, url, group_id;

  tab = e.target.closest(".draggable");
  url = tab.querySelector("a").href;
  group_id = tab.closest(".group").id;

  chrome.storage.local.get("groups", (local) => {
    var group_blocks = local.groups;
    group_blocks[group_id].tabs = tabs.filter((x) => x.url !== url);
    chrome.storage.local.set({ groups: group_blocks }, () => {
      setTabs(group_blocks[group_id].tabs);
      setTabTotal(document.querySelectorAll(".draggable").length);
      setGroups(JSON.stringify(group_blocks));
    });
  });
}

/**
 * Sets Chrome's local storage with an array (["group id", url_link]) consisting
 * of the tab to consider for removal after a user clicks to restore it.
 * @param {HTMLElement} e Node representing the tab that was clicked
 */
export function handleTabClick(e) {
  e.preventDefault();
  chrome.storage.local.set({ remove: [e.target.closest(".group").id, e.target.href] }, () => {});
}
